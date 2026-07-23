import { Prisma } from "../../generated/prisma/client";
import prisma from "../../lib/prisma";
import type { RequestContext } from "../../types/request-context";
import { ApiError } from "../../utils/api-error";
import { formatDocumentNumber } from "../number-series/number-series.service";

type SalesContext = RequestContext & {
  companyId: string;
  userId: string;
};

type SalesLineInput = {
  productVariantId?: unknown;
  blockId?: unknown;
  rackId?: unknown;
  shelfId?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_SALES_INPUT", `${field} is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function positiveDecimal(value: unknown, field: string, scale = 2) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new ApiError(400, "INVALID_SALES_NUMBER", `${field} must be greater than zero.`);
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

function locationKey(input: { warehouseId: string; blockId?: string; rackId?: string; shelfId?: string }) {
  return [input.warehouseId, input.blockId ?? "-", input.rackId ?? "-", input.shelfId ?? "-"].join(":");
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
    throw new ApiError(400, "NUMBER_SERIES_MISSING", `Create a ${documentType} number series before posting.`);
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

async function validateLineLocation(
  tx: Prisma.TransactionClient,
  companyId: string,
  warehouseId: string,
  input: Pick<SalesLineInput, "blockId" | "rackId" | "shelfId">,
) {
  const blockId = optionalString(input.blockId);
  const rackId = optionalString(input.rackId);
  const shelfId = optionalString(input.shelfId);

  if (blockId) {
    const block = await tx.warehouseBlock.findFirst({ where: { id: blockId, warehouseId, status: "ACTIVE" } });
    if (!block) {
      throw new ApiError(404, "WAREHOUSE_BLOCK_NOT_FOUND", "Warehouse block not found or inactive.");
    }
  }

  if (rackId) {
    const rack = await tx.warehouseRack.findFirst({
      where: { id: rackId, status: "ACTIVE", block: { warehouseId, warehouse: { companyId } } },
    });
    if (!rack) {
      throw new ApiError(404, "WAREHOUSE_RACK_NOT_FOUND", "Warehouse rack not found or inactive.");
    }
  }

  if (shelfId) {
    const shelf = await tx.warehouseShelf.findFirst({
      where: { id: shelfId, status: "ACTIVE", rack: { block: { warehouseId, warehouse: { companyId } } } },
    });
    if (!shelf) {
      throw new ApiError(404, "WAREHOUSE_SHELF_NOT_FOUND", "Warehouse shelf not found or inactive.");
    }
  }

  return { blockId, rackId, shelfId };
}

export async function getSalesSummary(companyId: string) {
  const [postedInvoices, totals] = await Promise.all([
    prisma.salesInvoice.count({ where: { companyId, status: "POSTED" } }),
    prisma.salesInvoice.aggregate({
      where: { companyId, status: "POSTED" },
      _sum: { taxableAmount: true, totalTaxAmount: true, grandTotal: true, costOfGoodsSold: true },
    }),
  ]);

  return {
    postedInvoices,
    taxableAmount: totals._sum.taxableAmount ?? 0,
    totalTaxAmount: totals._sum.totalTaxAmount ?? 0,
    grandTotal: totals._sum.grandTotal ?? 0,
    costOfGoodsSold: totals._sum.costOfGoodsSold ?? 0,
  };
}

export async function listSalesInvoices(companyId: string) {
  return prisma.salesInvoice.findMany({
    where: { companyId },
    include: {
      customer: true,
      warehouse: true,
      lines: { include: { product: true, productVariant: true }, orderBy: { lineOrder: "asc" } },
    },
    orderBy: { invoiceDate: "desc" },
    take: 50,
  });
}

export async function postSalesInvoice(context: SalesContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const customerId = requiredString(data.customerId, "Customer");
  const warehouseId = requiredString(data.warehouseId, "Warehouse");
  const invoiceDate = parseDate(data.invoiceDate);
  const taxMode = (optionalString(data.taxMode) ?? "CGST_SGST").toUpperCase();
  const rawLines = Array.isArray(data.lines) ? (data.lines as SalesLineInput[]) : [];

  if (!["CGST_SGST", "IGST"].includes(taxMode)) {
    throw new ApiError(400, "INVALID_TAX_MODE", "Tax mode must be CGST_SGST or IGST.");
  }

  if (rawLines.length === 0) {
    throw new ApiError(400, "SALES_LINES_REQUIRED", "At least one sales invoice line is required.");
  }

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, companyId: context.companyId, status: "ACTIVE" },
    });
    const warehouse = await tx.warehouse.findFirst({
      where: { id: warehouseId, companyId: context.companyId, status: "ACTIVE" },
    });

    if (!customer) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found or inactive.");
    }
    if (!warehouse) {
      throw new ApiError(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found or inactive.");
    }

    const receivableAccount = await requireAccount(tx, context.companyId, "1100");
    const revenueAccount = await requireAccount(tx, context.companyId, "4000");
    const gstPayableAccount = await requireAccount(tx, context.companyId, "2100");
    const cogsAccount = await requireAccount(tx, context.companyId, "5000");
    const inventoryAccount = await requireAccount(tx, context.companyId, "1200");
    const invoiceNumber = await nextDocumentNumber(tx, context.companyId, "SALES_INVOICE");
    const journalNumber = await nextDocumentNumber(tx, context.companyId, "JOURNAL_ENTRY");
    const preparedLines = [];

    for (const [index, line] of rawLines.entries()) {
      const productVariantId = requiredString(line.productVariantId, "Product variant");
      const variant = await tx.productVariant.findFirst({
        where: { id: productVariantId, companyId: context.companyId, status: "ACTIVE", product: { status: "ACTIVE" } },
        include: { product: { include: { hsnCode: true, taxRate: true } } },
      });

      if (!variant) {
        throw new ApiError(404, "PRODUCT_VARIANT_NOT_FOUND", "Product variant not found or inactive.");
      }

      const quantity = positiveDecimal(line.quantity, "Quantity", 3);
      const unitPrice = positiveDecimal(line.unitPrice, "Unit price", 2);
      const location = await validateLineLocation(tx, context.companyId, warehouseId, line);
      const key = locationKey({ warehouseId, ...location });
      const balance = await tx.stockBalance.findUnique({
        where: {
          companyId_productVariantId_warehouseId_locationKey: {
            companyId: context.companyId,
            productVariantId,
            warehouseId,
            locationKey: key,
          },
        },
      });

      if (!balance || new Prisma.Decimal(balance.quantity).lt(quantity)) {
        throw new ApiError(400, "INSUFFICIENT_STOCK", `${variant.name} does not have enough available stock.`);
      }

      const unitCost = new Prisma.Decimal(balance.averageCost ?? 0);
      const taxableAmount = quantity.mul(unitPrice).toDecimalPlaces(2);
      const taxRate = variant.product.taxRate;
      const cgstRate = taxMode === "CGST_SGST" ? taxRate?.cgstRate ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
      const sgstRate = taxMode === "CGST_SGST" ? taxRate?.sgstRate ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
      const igstRate = taxMode === "IGST" ? taxRate?.igstRate ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
      const cgstAmount = taxableAmount.mul(cgstRate).div(100).toDecimalPlaces(2);
      const sgstAmount = taxableAmount.mul(sgstRate).div(100).toDecimalPlaces(2);
      const igstAmount = taxableAmount.mul(igstRate).div(100).toDecimalPlaces(2);
      const lineTotal = taxableAmount.plus(cgstAmount).plus(sgstAmount).plus(igstAmount).toDecimalPlaces(2);
      const costAmount = quantity.mul(unitCost).toDecimalPlaces(2);

      preparedLines.push({
        companyId: context.companyId,
        productId: variant.productId,
        productVariantId,
        ...location,
        locationKey: key,
        hsnCode: variant.product.hsnCode?.code,
        quantity,
        unitPrice,
        unitCost,
        taxableAmount,
        cgstRate,
        sgstRate,
        igstRate,
        cgstAmount,
        sgstAmount,
        igstAmount,
        lineTotal,
        costAmount,
        lineOrder: index + 1,
      });
    }

    const taxableAmount = preparedLines.reduce((total, line) => total.plus(line.taxableAmount), new Prisma.Decimal(0));
    const cgstAmount = preparedLines.reduce((total, line) => total.plus(line.cgstAmount), new Prisma.Decimal(0));
    const sgstAmount = preparedLines.reduce((total, line) => total.plus(line.sgstAmount), new Prisma.Decimal(0));
    const igstAmount = preparedLines.reduce((total, line) => total.plus(line.igstAmount), new Prisma.Decimal(0));
    const totalTaxAmount = cgstAmount.plus(sgstAmount).plus(igstAmount).toDecimalPlaces(2);
    const grandTotal = taxableAmount.plus(totalTaxAmount).toDecimalPlaces(2);
    const costOfGoodsSold = preparedLines.reduce((total, line) => total.plus(line.costAmount), new Prisma.Decimal(0));

    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId: context.companyId,
        entryNumber: journalNumber,
        entryDate: invoiceDate,
        sourceModule: "sales",
        sourceType: "SALES_INVOICE",
        narration: `Sales invoice ${invoiceNumber}`,
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: receivableAccount.id, debitAmount: grandTotal, narration: `Customer receivable ${invoiceNumber}`, lineOrder: 1 },
            { accountId: revenueAccount.id, creditAmount: taxableAmount, narration: `Sales revenue ${invoiceNumber}`, lineOrder: 2 },
            ...(totalTaxAmount.gt(0)
              ? [{ accountId: gstPayableAccount.id, creditAmount: totalTaxAmount, narration: `GST payable ${invoiceNumber}`, lineOrder: 3 }]
              : []),
            { accountId: cogsAccount.id, debitAmount: costOfGoodsSold, narration: `COGS ${invoiceNumber}`, lineOrder: 4 },
            { accountId: inventoryAccount.id, creditAmount: costOfGoodsSold, narration: `Inventory issue ${invoiceNumber}`, lineOrder: 5 },
          ],
        },
      },
    });

    const invoice = await tx.salesInvoice.create({
      data: {
        companyId: context.companyId,
        customerId,
        warehouseId,
        invoiceNumber,
        invoiceDate,
        taxMode,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalTaxAmount,
        grandTotal,
        costOfGoodsSold,
        status: "POSTED",
        journalEntryId: journalEntry.id,
        postedByUserId: context.userId,
        postedAt: new Date(),
        narration: optionalString(data.narration),
        lines: { create: preparedLines.map(({ locationKey: _locationKey, ...line }) => line) },
      },
      include: { customer: true, warehouse: true, lines: { include: { product: true, productVariant: true } } },
    });

    for (const line of preparedLines) {
      const balance = await tx.stockBalance.findUniqueOrThrow({
        where: {
          companyId_productVariantId_warehouseId_locationKey: {
            companyId: context.companyId,
            productVariantId: line.productVariantId,
            warehouseId,
            locationKey: line.locationKey,
          },
        },
      });
      const newQuantity = new Prisma.Decimal(balance.quantity).minus(line.quantity);
      const newValue = new Prisma.Decimal(balance.stockValue).minus(line.costAmount).toDecimalPlaces(2);

      if (newQuantity.lt(0)) {
        throw new ApiError(400, "NEGATIVE_STOCK_BLOCKED", "Sales invoice posting would create negative stock.");
      }

      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantity: newQuantity, stockValue: newValue.lt(0) ? 0 : newValue },
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
          locationKey: line.locationKey,
          movementType: "SALES_INVOICE",
          documentType: "SALES_INVOICE",
          documentNumber: invoiceNumber,
          documentDate: invoiceDate,
          quantityOut: line.quantity,
          unitCost: line.unitCost,
          totalValue: line.costAmount,
          narration: optionalString(data.narration),
          createdByUserId: context.userId,
        },
      });
    }

    await tx.partyLedgerEntry.create({
      data: {
        companyId: context.companyId,
        partyType: "CUSTOMER",
        customerId,
        journalEntryId: journalEntry.id,
        entryType: "INVOICE",
        documentType: "SALES_INVOICE",
        documentId: invoice.id,
        documentNumber: invoiceNumber,
        entryDate: invoiceDate,
        debitAmount: grandTotal,
        narration: `Sales invoice ${invoiceNumber}`,
      },
    });

    await tx.journalEntry.update({ where: { id: journalEntry.id }, data: { sourceId: invoice.id } });
    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "sales",
        action: "POST",
        entityType: "SalesInvoice",
        entityId: invoice.id,
        description: "Sales invoice posted.",
        afterData: json(invoice),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return invoice;
  });
}
