import { Prisma } from "../../generated/prisma/client";
import prisma from "../../lib/prisma";
import type { RequestContext } from "../../types/request-context";
import { ApiError } from "../../utils/api-error";
import { formatDocumentNumber } from "../number-series/number-series.service";

type NoteContext = RequestContext & {
  companyId: string;
  userId: string;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_NOTE_INPUT", `${field} is required.`);
  }

  return value.trim();
}

function positiveAmount(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new ApiError(400, "INVALID_NOTE_AMOUNT", "Note amount must be greater than zero.");
  }

  return new Prisma.Decimal(number.toFixed(2));
}

function parseDate(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "INVALID_DATE", "Note date is invalid.");
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
    throw new ApiError(400, "NUMBER_SERIES_MISSING", `Create a ${documentType} number series before posting notes.`);
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

export async function listFinancialNotes(companyId: string) {
  return prisma.financialNote.findMany({
    where: { companyId },
    include: { customer: true, supplier: true, journalEntry: true },
    orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function postFinancialNote(context: NoteContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const partyType = requiredString(data.partyType, "Party type").toUpperCase();
  const noteType = requiredString(data.noteType, "Note type").toUpperCase();
  const noteDate = parseDate(data.noteDate);
  const amount = positiveAmount(data.amount);
  const reason = requiredString(data.reason, "Reason");

  if (!["CUSTOMER", "SUPPLIER"].includes(partyType)) {
    throw new ApiError(400, "INVALID_PARTY_TYPE", "Party type must be CUSTOMER or SUPPLIER.");
  }

  if (!["CREDIT_NOTE", "DEBIT_NOTE"].includes(noteType)) {
    throw new ApiError(400, "INVALID_NOTE_TYPE", "Note type must be CREDIT_NOTE or DEBIT_NOTE.");
  }

  return prisma.$transaction(async (tx) => {
    const receivableAccount = await requireAccount(tx, context.companyId, "1100");
    const payableAccount = await requireAccount(tx, context.companyId, "2000");
    const adjustmentAccount = await requireAccount(tx, context.companyId, "5100");
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

    const noteNumber = await nextDocumentNumber(tx, context.companyId, noteType);
    const journalNumber = await nextDocumentNumber(tx, context.companyId, "JOURNAL_ENTRY");
    const reducesCustomerBalance = partyType === "CUSTOMER" && noteType === "CREDIT_NOTE";
    const increasesCustomerBalance = partyType === "CUSTOMER" && noteType === "DEBIT_NOTE";
    const reducesSupplierBalance = partyType === "SUPPLIER" && noteType === "DEBIT_NOTE";
    const sourceType = `${partyType}_${noteType}`;

    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId: context.companyId,
        entryNumber: journalNumber,
        entryDate: noteDate,
        sourceModule: "notes",
        sourceType,
        narration: reason,
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: {
          create: [
            ...(reducesCustomerBalance
              ? [
                  { accountId: adjustmentAccount.id, debitAmount: amount, narration: noteNumber, lineOrder: 1 },
                  { accountId: receivableAccount.id, creditAmount: amount, narration: noteNumber, lineOrder: 2 },
                ]
              : []),
            ...(increasesCustomerBalance
              ? [
                  { accountId: receivableAccount.id, debitAmount: amount, narration: noteNumber, lineOrder: 1 },
                  { accountId: adjustmentAccount.id, creditAmount: amount, narration: noteNumber, lineOrder: 2 },
                ]
              : []),
            ...(reducesSupplierBalance
              ? [
                  { accountId: payableAccount.id, debitAmount: amount, narration: noteNumber, lineOrder: 1 },
                  { accountId: adjustmentAccount.id, creditAmount: amount, narration: noteNumber, lineOrder: 2 },
                ]
              : [
                  { accountId: adjustmentAccount.id, debitAmount: partyType === "SUPPLIER" ? amount : 0, narration: noteNumber, lineOrder: 1 },
                  { accountId: payableAccount.id, creditAmount: partyType === "SUPPLIER" ? amount : 0, narration: noteNumber, lineOrder: 2 },
                ]),
          ].filter((line) => new Prisma.Decimal(line.debitAmount ?? 0).gt(0) || new Prisma.Decimal(line.creditAmount ?? 0).gt(0)),
        },
      },
    });

    const note = await tx.financialNote.create({
      data: {
        companyId: context.companyId,
        partyType: partyType as "CUSTOMER" | "SUPPLIER",
        noteType: noteType as "CREDIT_NOTE" | "DEBIT_NOTE",
        customerId,
        supplierId,
        journalEntryId: journalEntry.id,
        noteNumber,
        noteDate,
        amount,
        reason,
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
      },
      include: { customer: true, supplier: true, journalEntry: true },
    });

    await tx.partyLedgerEntry.create({
      data: {
        companyId: context.companyId,
        partyType: partyType as "CUSTOMER" | "SUPPLIER",
        customerId,
        supplierId,
        journalEntryId: journalEntry.id,
        entryType: noteType as "CREDIT_NOTE" | "DEBIT_NOTE",
        documentType: sourceType,
        documentId: note.id,
        documentNumber: noteNumber,
        entryDate: noteDate,
        debitAmount: increasesCustomerBalance || reducesSupplierBalance ? amount : 0,
        creditAmount: reducesCustomerBalance || (!reducesSupplierBalance && partyType === "SUPPLIER") ? amount : 0,
        narration: reason,
      },
    });

    await tx.journalEntry.update({ where: { id: journalEntry.id }, data: { sourceId: note.id } });
    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "notes",
        action: "POST",
        entityType: "FinancialNote",
        entityId: note.id,
        description: `${sourceType} posted.`,
        afterData: json(note),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return note;
  });
}
