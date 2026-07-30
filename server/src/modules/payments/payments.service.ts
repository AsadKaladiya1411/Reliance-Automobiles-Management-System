import { Prisma } from "../../generated/prisma/client";
import prisma from "../../lib/prisma";
import type { RequestContext } from "../../types/request-context";
import { ApiError } from "../../utils/api-error";
import { formatDocumentNumber } from "../number-series/number-series.service";
import { mergePaymentAllocations, validatePaymentAllocations } from "./payment-allocation.utils";

type PaymentContext = RequestContext & {
  companyId: string;
  userId: string;
};

type AllocationInput = {
  documentType?: unknown;
  documentId?: unknown;
  documentNumber?: unknown;
  amount?: unknown;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_PAYMENT_INPUT", `${field} is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function positiveAmount(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new ApiError(400, "INVALID_PAYMENT_AMOUNT", "Payment amount must be greater than zero.");
  }

  return new Prisma.Decimal(number.toFixed(2));
}

function parseDate(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "INVALID_DATE", "Payment date is invalid.");
  }

  return date;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function nextDocumentNumber(tx: Prisma.TransactionClient, companyId: string, documentType: string) {
  const series = await tx.numberSeries.findFirst({
    where: { companyId, documentType, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });

  if (!series) {
    throw new ApiError(400, "NUMBER_SERIES_MISSING", `Create a ${documentType} number series before posting payments.`);
  }

  await tx.numberSeries.update({ where: { id: series.id }, data: { nextNumber: { increment: 1 } } });
  return formatDocumentNumber(series);
}

async function requireAccount(tx: Prisma.TransactionClient, companyId: string, code: string) {
  const account = await tx.account.findFirst({ where: { companyId, code, status: "ACTIVE" } });

  if (!account) {
    throw new ApiError(400, "ACCOUNT_MISSING", `Required account ${code} is missing. Seed default accounts first.`);
  }

  return account;
}

export async function getPaymentSummary(companyId: string) {
  const [receipts, payments, totals] = await Promise.all([
    prisma.payment.count({ where: { companyId, partyType: "CUSTOMER", status: "POSTED" } }),
    prisma.payment.count({ where: { companyId, partyType: "SUPPLIER", status: "POSTED" } }),
    prisma.payment.groupBy({
      by: ["partyType"],
      where: { companyId, status: "POSTED" },
      _sum: { amount: true },
    }),
  ]);

  return {
    receipts,
    payments,
    receiptTotal: totals.find((row) => row.partyType === "CUSTOMER")?._sum.amount ?? 0,
    paymentTotal: totals.find((row) => row.partyType === "SUPPLIER")?._sum.amount ?? 0,
  };
}

export async function listPayments(companyId: string) {
  return prisma.payment.findMany({
    where: { companyId },
    include: { customer: true, supplier: true, paymentMode: true, allocations: true },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}

async function openSettlementDocuments(
  tx: Prisma.TransactionClient,
  companyId: string,
  partyType: "CUSTOMER" | "SUPPLIER",
  partyId: string,
) {
  const where = {
    companyId,
    partyType,
    ...(partyType === "CUSTOMER" ? { customerId: partyId } : { supplierId: partyId }),
  };
  const [ledgerEntries, allocations] = await Promise.all([
    tx.partyLedgerEntry.findMany({
      where,
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    }),
    tx.paymentAllocation.groupBy({
      by: ["documentType", "documentNumber"],
      where,
      _sum: { allocatedAmount: true },
    }),
  ]);
  const allocatedByDocument = new Map(
    allocations.map((allocation) => [
      `${allocation.documentType}:${allocation.documentNumber}`,
      new Prisma.Decimal(allocation._sum.allocatedAmount ?? 0),
    ]),
  );

  return ledgerEntries
    .filter((entry) => (partyType === "CUSTOMER" ? new Prisma.Decimal(entry.debitAmount).gt(0) : new Prisma.Decimal(entry.creditAmount).gt(0)))
    .map((entry) => {
      const documentAmount = partyType === "CUSTOMER" ? new Prisma.Decimal(entry.debitAmount) : new Prisma.Decimal(entry.creditAmount);
      const allocatedAmount = allocatedByDocument.get(`${entry.documentType}:${entry.documentNumber}`) ?? new Prisma.Decimal(0);
      return {
        id: entry.id,
        documentType: entry.documentType,
        documentId: entry.documentId,
        documentNumber: entry.documentNumber,
        entryDate: entry.entryDate,
        documentAmount,
        allocatedAmount,
        openAmount: documentAmount.minus(allocatedAmount).toDecimalPlaces(2),
        narration: entry.narration,
      };
    })
    .filter((entry) => entry.openAmount.gt(0));
}

export async function listOpenSettlementDocuments(companyId: string, partyTypeInput: unknown, partyIdInput: unknown) {
  const partyType = requiredString(partyTypeInput, "Party type").toUpperCase();
  const partyId = requiredString(partyIdInput, "Party");

  if (!["CUSTOMER", "SUPPLIER"].includes(partyType)) {
    throw new ApiError(400, "INVALID_PARTY_TYPE", "Party type must be CUSTOMER or SUPPLIER.");
  }

  return prisma.$transaction((tx) => openSettlementDocuments(tx, companyId, partyType as "CUSTOMER" | "SUPPLIER", partyId));
}

export async function postPayment(context: PaymentContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const partyType = requiredString(data.partyType, "Party type").toUpperCase();
  const paymentModeId = requiredString(data.paymentModeId, "Payment mode");
  const paymentDate = parseDate(data.paymentDate);
  const amount = positiveAmount(data.amount);
  const rawAllocations = Array.isArray(data.allocations) ? (data.allocations as AllocationInput[]) : [];

  if (!["CUSTOMER", "SUPPLIER"].includes(partyType)) {
    throw new ApiError(400, "INVALID_PARTY_TYPE", "Party type must be CUSTOMER or SUPPLIER.");
  }

  return prisma.$transaction(async (tx) => {
    const paymentMode = await tx.paymentMode.findFirst({
      where: { id: paymentModeId, companyId: context.companyId, status: "ACTIVE" },
    });

    if (!paymentMode) {
      throw new ApiError(404, "PAYMENT_MODE_NOT_FOUND", "Payment mode not found or inactive.");
    }

    if (paymentMode.requiresReference && !optionalString(data.referenceNo)) {
      throw new ApiError(400, "PAYMENT_REFERENCE_REQUIRED", "Reference number is required for this payment mode.");
    }

    const cashOrBankAccount = await requireAccount(
      tx,
      context.companyId,
      paymentMode.paymentType.toUpperCase() === "CASH" ? "1000" : "1010",
    );
    const receivableAccount = await requireAccount(tx, context.companyId, "1100");
    const payableAccount = await requireAccount(tx, context.companyId, "2000");
    const documentType = partyType === "CUSTOMER" ? "PAYMENT_RECEIPT" : "PAYMENT_VOUCHER";
    const paymentNumber = await nextDocumentNumber(tx, context.companyId, documentType);
    const journalNumber = await nextDocumentNumber(tx, context.companyId, "JOURNAL_ENTRY");
    const customerId = partyType === "CUSTOMER" ? requiredString(data.partyId, "Customer") : undefined;
    const supplierId = partyType === "SUPPLIER" ? requiredString(data.partyId, "Supplier") : undefined;

    if (customerId) {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, companyId: context.companyId, status: "ACTIVE" },
      });
      if (!customer) {
        throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found or inactive.");
      }
    }

    if (supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: { id: supplierId, companyId: context.companyId, status: "ACTIVE" },
      });
      if (!supplier) {
        throw new ApiError(404, "SUPPLIER_NOT_FOUND", "Supplier not found or inactive.");
      }
    }

    const openDocuments = await openSettlementDocuments(tx, context.companyId, partyType as "CUSTOMER" | "SUPPLIER", customerId ?? supplierId ?? "");
    const rawPreparedAllocations = rawAllocations
      .map((allocation) => ({
        documentType: requiredString(allocation.documentType, "Allocation document type"),
        documentNumber: requiredString(allocation.documentNumber, "Allocation document number"),
        documentId: optionalString(allocation.documentId),
        allocatedAmount: positiveAmount(allocation.amount),
      }))
      .filter((allocation) => allocation.allocatedAmount.gt(0));
    const allocations = mergePaymentAllocations(rawPreparedAllocations);
    validatePaymentAllocations(amount, allocations, openDocuments);

    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId: context.companyId,
        entryNumber: journalNumber,
        entryDate: paymentDate,
        sourceModule: "payments",
        sourceType: documentType,
        narration: optionalString(data.narration) ?? paymentNumber,
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: {
          create: partyType === "CUSTOMER"
            ? [
                { accountId: cashOrBankAccount.id, debitAmount: amount, narration: paymentNumber, lineOrder: 1 },
                { accountId: receivableAccount.id, creditAmount: amount, narration: paymentNumber, lineOrder: 2 },
              ]
            : [
                { accountId: payableAccount.id, debitAmount: amount, narration: paymentNumber, lineOrder: 1 },
                { accountId: cashOrBankAccount.id, creditAmount: amount, narration: paymentNumber, lineOrder: 2 },
              ],
        },
      },
    });

    const payment = await tx.payment.create({
      data: {
        companyId: context.companyId,
        partyType: partyType as "CUSTOMER" | "SUPPLIER",
        customerId,
        supplierId,
        paymentModeId,
        journalEntryId: journalEntry.id,
        paymentNumber,
        paymentDate,
        amount,
        referenceNo: optionalString(data.referenceNo),
        narration: optionalString(data.narration),
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
      },
      include: { customer: true, supplier: true, paymentMode: true },
    });

    if (allocations.length > 0) {
      await tx.paymentAllocation.createMany({
        data: allocations.map((allocation) => ({
          companyId: context.companyId,
          paymentId: payment.id,
          partyType: partyType as "CUSTOMER" | "SUPPLIER",
          customerId,
          supplierId,
          documentType: allocation.documentType,
          documentId: allocation.documentId,
          documentNumber: allocation.documentNumber,
          allocatedAmount: allocation.allocatedAmount,
        })),
      });
    }

    await tx.partyLedgerEntry.create({
      data: {
        companyId: context.companyId,
        partyType: partyType as "CUSTOMER" | "SUPPLIER",
        customerId,
        supplierId,
        journalEntryId: journalEntry.id,
        entryType: "PAYMENT",
        documentType,
        documentId: payment.id,
        documentNumber: paymentNumber,
        entryDate: paymentDate,
        debitAmount: partyType === "SUPPLIER" ? amount : 0,
        creditAmount: partyType === "CUSTOMER" ? amount : 0,
        narration: optionalString(data.narration) ?? paymentNumber,
      },
    });

    await tx.journalEntry.update({ where: { id: journalEntry.id }, data: { sourceId: payment.id } });
    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "payments",
        action: "POST",
        entityType: "Payment",
        entityId: payment.id,
        description: `${documentType} posted.`,
        afterData: json({ payment, allocations }),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return payment;
  });
}
