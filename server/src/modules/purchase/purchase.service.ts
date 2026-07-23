import { Prisma } from "../../generated/prisma/client";
import prisma from "../../lib/prisma";
import type { RequestContext } from "../../types/request-context";
import { ApiError } from "../../utils/api-error";
import { formatDocumentNumber } from "../number-series/number-series.service";

type PurchaseContext = RequestContext & {
  companyId: string;
  userId: string;
};

type PurchaseLineInput = {
  productVariantId?: unknown;
  blockId?: unknown;
  rackId?: unknown;
  shelfId?: unknown;
  quantity?: unknown;
  unitCost?: unknown;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_PURCHASE_INPUT", `${field} is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function positiveDecimal(value: unknown, field: string, scale = 2) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new ApiError(400, "INVALID_PURCHASE_NUMBER", `${field} must be greater than zero.`);
  }

  return new Prisma.Decimal(number.toFixed(scale));
}

function parseDate(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "INVALID_DATE", "Invoice date is invalid.");
  }

  return date;
}

function locationKey(input: {
  warehouseId: string;
  blockId?: string;
  rackId?: string;
  shelfId?: string;
}) {
  return [
    input.warehouseId,
    input.blockId ?? "-",
    input.rackId ?? "-",
    input.shelfId ?? "-",
  ].join(":");
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
  documentType: string,
  missingMessage: string,
) {
  const series = await tx.numberSeries.findFirst({
    where: { companyId, documentType, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });

  if (!series) {
    throw new ApiError(400, "NUMBER_SERIES_MISSING", missingMessage);
  }

  await tx.numberSeries.update({
    where: { id: series.id },
    data: { nextNumber: { increment: 1 } },
  });

  return formatDocumentNumber(series);
}

async function requireAccount(tx: Prisma.TransactionClient, companyId: string, code: string) {
  const account = await tx.account.findFirst({
    where: { companyId, code, status: "ACTIVE" },
  });

  if (!account) {
    throw new ApiError(400, "ACCOUNT_MISSING", `Required account ${code} is missing. Seed default accounts first.`);
  }

  return account;
}

async function validateWarehouse(tx: Prisma.TransactionClient, companyId: string, warehouseId: string) {
  const warehouse = await tx.warehouse.findFirst({
    where: { id: warehouseId, companyId, status: "ACTIVE" },
  });

  if (!warehouse) {
    throw new ApiError(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found or inactive.");
  }

  return warehouse;
}

async function validateLineLocation(
  tx: Prisma.TransactionClient,
  companyId: string,
  warehouseId: string,
  input: Pick<PurchaseLineInput, "blockId" | "rackId" | "shelfId">,
) {
  const blockId = optionalString(input.blockId);
  const rackId = optionalString(input.rackId);
  const shelfId = optionalString(input.shelfId);

  if (blockId) {
    const block = await tx.warehouseBlock.findFirst({
      where: { id: blockId, warehouseId, status: "ACTIVE" },
    });
    if (!block) {
      throw new ApiError(404, "WAREHOUSE_BLOCK_NOT_FOUND", "Warehouse block not found or inactive.");
    }
  }

  if (rackId) {
    const rack = await tx.warehouseRack.findFirst({
      where: {
        id: rackId,
        status: "ACTIVE",
        block: { warehouseId, warehouse: { companyId } },
      },
    });
    if (!rack) {
      throw new ApiError(404, "WAREHOUSE_RACK_NOT_FOUND", "Warehouse rack not found or inactive.");
    }
  }

  if (shelfId) {
    const shelf = await tx.warehouseShelf.findFirst({
      where: {
        id: shelfId,
        status: "ACTIVE",
        rack: { block: { warehouseId, warehouse: { companyId } } },
      },
    });
    if (!shelf) {
      throw new ApiError(404, "WAREHOUSE_SHELF_NOT_FOUND", "Warehouse shelf not found or inactive.");
    }
  }

  return { blockId, rackId, shelfId };
}

export async function getPurchaseSummary(companyId: string) {
  const [postedInvoices, totals] = await Promise.all([
    prisma.purchaseInvoice.count({ where: { companyId, status: "POSTED" } }),
    prisma.purchaseInvoice.aggregate({
      where: { companyId, status: "POSTED" },
      _sum: { taxableAmount: true, totalTaxAmount: true, grandTotal: true },
    }),
  ]);

  return {
    postedInvoices,
    taxableAmount: totals._sum.taxableAmount ?? 0,
    totalTaxAmount: totals._sum.totalTaxAmount ?? 0,
    grandTotal: totals._sum.grandTotal ?? 0,
  };
}

export async function listPurchaseInvoices(companyId: string) {
  return prisma.purchaseInvoice.findMany({
    where: { companyId },
    include: {
      supplier: true,
      warehouse: true,
      lines: { include: { product: true, productVariant: true }, orderBy: { lineOrder: "asc" } },
    },
    orderBy: { invoiceDate: "desc" },
    take: 50,
  });
}

export async function postPurchaseInvoice(context: PurchaseContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const supplierId = requiredString(data.supplierId, "Supplier");
  const warehouseId = requiredString(data.warehouseId, "Warehouse");
  const invoiceDate = parseDate(data.invoiceDate);
  const taxMode = (optionalString(data.taxMode) ?? "CGST_SGST").toUpperCase();
  const rawLines = Array.isArray(data.lines) ? (data.lines as PurchaseLineInput[]) : [];

  if (!["CGST_SGST", "IGST"].includes(taxMode)) {
    throw new ApiError(400, "INVALID_TAX_MODE", "Tax mode must be CGST_SGST or IGST.");
  }

  if (rawLines.length === 0) {
    throw new ApiError(400, "PURCHASE_LINES_REQUIRED", "At least one purchase invoice line is required.");
  }

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: supplierId, companyId: context.companyId, status: "ACTIVE" },
    });

    if (!supplier) {
      throw new ApiError(404, "SUPPLIER_NOT_FOUND", "Supplier not found or inactive.");
    }

    await validateWarehouse(tx, context.companyId, warehouseId);

    const inventoryAccount = await requireAccount(tx, context.companyId, "1200");
    const gstInputAccount = await requireAccount(tx, context.companyId, "2200");
    const payableAccount = await requireAccount(tx, context.companyId, "2000");
    const invoiceNumber = await nextDocumentNumber(
      tx,
      context.companyId,
      "PURCHASE_INVOICE",
      "Create a PURCHASE_INVOICE number series before posting purchase invoices.",
    );
    const journalNumber = await nextDocumentNumber(
      tx,
      context.companyId,
      "JOURNAL_ENTRY",
      "Create a JOURNAL_ENTRY number series before posting purchase invoices.",
    );

    const preparedLines = [];

    for (const [index, line] of rawLines.entries()) {
      const productVariantId = requiredString(line.productVariantId, "Product variant");
      const variant = await tx.productVariant.findFirst({
        where: {
          id: productVariantId,
          companyId: context.companyId,
          status: "ACTIVE",
          product: { status: "ACTIVE" },
        },
        include: { product: { include: { hsnCode: true, taxRate: true } } },
      });

      if (!variant) {
        throw new ApiError(404, "PRODUCT_VARIANT_NOT_FOUND", "Product variant not found or inactive.");
      }

      const quantity = positiveDecimal(line.quantity, "Quantity", 3);
      const unitCost = positiveDecimal(line.unitCost, "Unit cost", 2);
      const taxableAmount = quantity.mul(unitCost).toDecimalPlaces(2);
      const taxRate = variant.product.taxRate;
      const cgstRate = taxMode === "CGST_SGST" ? taxRate?.cgstRate ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
      const sgstRate = taxMode === "CGST_SGST" ? taxRate?.sgstRate ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
      const igstRate = taxMode === "IGST" ? taxRate?.igstRate ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
      const cgstAmount = taxableAmount.mul(cgstRate).div(100).toDecimalPlaces(2);
      const sgstAmount = taxableAmount.mul(sgstRate).div(100).toDecimalPlaces(2);
      const igstAmount = taxableAmount.mul(igstRate).div(100).toDecimalPlaces(2);
      const lineTotal = taxableAmount.plus(cgstAmount).plus(sgstAmount).plus(igstAmount).toDecimalPlaces(2);
      const location = await validateLineLocation(tx, context.companyId, warehouseId, line);

      preparedLines.push({
        companyId: context.companyId,
        productId: variant.productId,
        productVariantId,
        ...location,
        hsnCode: variant.product.hsnCode?.code,
        quantity,
        unitCost,
        taxableAmount,
        cgstRate,
        sgstRate,
        igstRate,
        cgstAmount,
        sgstAmount,
        igstAmount,
        lineTotal,
        lineOrder: index + 1,
      });
    }

    const taxableAmount = preparedLines.reduce((total, line) => total.plus(line.taxableAmount), new Prisma.Decimal(0));
    const cgstAmount = preparedLines.reduce((total, line) => total.plus(line.cgstAmount), new Prisma.Decimal(0));
    const sgstAmount = preparedLines.reduce((total, line) => total.plus(line.sgstAmount), new Prisma.Decimal(0));
    const igstAmount = preparedLines.reduce((total, line) => total.plus(line.igstAmount), new Prisma.Decimal(0));
    const totalTaxAmount = cgstAmount.plus(sgstAmount).plus(igstAmount).toDecimalPlaces(2);
    const grandTotal = taxableAmount.plus(totalTaxAmount).toDecimalPlaces(2);

    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId: context.companyId,
        entryNumber: journalNumber,
        entryDate: invoiceDate,
        sourceModule: "purchase",
        sourceType: "PURCHASE_INVOICE",
        narration: `Purchase invoice ${invoiceNumber}`,
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: inventoryAccount.id,
              debitAmount: taxableAmount,
              narration: `Inventory purchase ${invoiceNumber}`,
              lineOrder: 1,
            },
            ...(totalTaxAmount.gt(0)
              ? [{
                  accountId: gstInputAccount.id,
                  debitAmount: totalTaxAmount,
                  narration: `GST input ${invoiceNumber}`,
                  lineOrder: 2,
                }]
              : []),
            {
              accountId: payableAccount.id,
              creditAmount: grandTotal,
              narration: `Supplier payable ${invoiceNumber}`,
              lineOrder: 3,
            },
          ],
        },
      },
    });

    const invoice = await tx.purchaseInvoice.create({
      data: {
        companyId: context.companyId,
        supplierId,
        warehouseId,
        invoiceNumber,
        supplierBillNumber: optionalString(data.supplierBillNumber),
        invoiceDate,
        taxMode,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalTaxAmount,
        grandTotal,
        status: "POSTED",
        journalEntryId: journalEntry.id,
        postedByUserId: context.userId,
        postedAt: new Date(),
        narration: optionalString(data.narration),
        lines: { create: preparedLines },
      },
      include: { supplier: true, warehouse: true, lines: { include: { product: true, productVariant: true } } },
    });

    for (const line of preparedLines) {
      const key = locationKey({ warehouseId, blockId: line.blockId, rackId: line.rackId, shelfId: line.shelfId });
      const existingBalance = await tx.stockBalance.findUnique({
        where: {
          companyId_productVariantId_warehouseId_locationKey: {
            companyId: context.companyId,
            productVariantId: line.productVariantId,
            warehouseId,
            locationKey: key,
          },
        },
      });
      const newQuantity = new Prisma.Decimal(existingBalance?.quantity ?? 0).plus(line.quantity);
      const newValue = new Prisma.Decimal(existingBalance?.stockValue ?? 0).plus(line.taxableAmount).toDecimalPlaces(2);
      const averageCost = newValue.div(newQuantity).toDecimalPlaces(2);

      await tx.stockBalance.upsert({
        where: {
          companyId_productVariantId_warehouseId_locationKey: {
            companyId: context.companyId,
            productVariantId: line.productVariantId,
            warehouseId,
            locationKey: key,
          },
        },
        create: {
          companyId: context.companyId,
          productId: line.productId,
          productVariantId: line.productVariantId,
          warehouseId,
          blockId: line.blockId,
          rackId: line.rackId,
          shelfId: line.shelfId,
          locationKey: key,
          quantity: line.quantity,
          averageCost: line.unitCost,
          stockValue: line.taxableAmount,
        },
        update: {
          quantity: newQuantity,
          averageCost,
          stockValue: newValue,
        },
      });

      await tx.stockMovement.create({
        data: {
          companyId: context.companyId,
          productId: line.productId,
          productVariantId: line.productVariantId,
          warehouseId,
          blockId: line.blockId,
          rackId: line.rackId,
          shelfId: line.shelfId,
          locationKey: key,
          movementType: "PURCHASE_INVOICE",
          documentType: "PURCHASE_INVOICE",
          documentNumber: invoiceNumber,
          documentDate: invoiceDate,
          quantityIn: line.quantity,
          unitCost: line.unitCost,
          totalValue: line.taxableAmount,
          narration: optionalString(data.narration),
          createdByUserId: context.userId,
        },
      });
    }

    await tx.partyLedgerEntry.create({
      data: {
        companyId: context.companyId,
        partyType: "SUPPLIER",
        supplierId,
        journalEntryId: journalEntry.id,
        entryType: "INVOICE",
        documentType: "PURCHASE_INVOICE",
        documentId: invoice.id,
        documentNumber: invoiceNumber,
        entryDate: invoiceDate,
        creditAmount: grandTotal,
        narration: `Purchase invoice ${invoiceNumber}`,
      },
    });

    await tx.journalEntry.update({
      where: { id: journalEntry.id },
      data: { sourceId: invoice.id },
    });

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "purchase",
        action: "POST",
        entityType: "PurchaseInvoice",
        entityId: invoice.id,
        description: "Purchase invoice posted.",
        afterData: json(invoice),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return invoice;
  });
}
