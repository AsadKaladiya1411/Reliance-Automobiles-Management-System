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

type ReturnLineInput = {
  purchaseInvoiceLineId?: unknown;
  quantity?: unknown;
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
  const [approvedOrders, postedInvoices, postedReturns, invoiceTotals, returnTotals] = await Promise.all([
    prisma.purchaseOrder.count({ where: { companyId, status: "APPROVED" } }),
    prisma.purchaseInvoice.count({ where: { companyId, status: "POSTED" } }),
    prisma.purchaseReturn.count({ where: { companyId } }),
    prisma.purchaseInvoice.aggregate({
      where: { companyId, status: "POSTED" },
      _sum: { taxableAmount: true, totalTaxAmount: true, grandTotal: true },
    }),
    prisma.purchaseReturn.aggregate({
      where: { companyId },
      _sum: { taxableAmount: true, totalTaxAmount: true, grandTotal: true },
    }),
  ]);
  const grossTaxableAmount = new Prisma.Decimal(invoiceTotals._sum.taxableAmount ?? 0);
  const grossTaxAmount = new Prisma.Decimal(invoiceTotals._sum.totalTaxAmount ?? 0);
  const grossGrandTotal = new Prisma.Decimal(invoiceTotals._sum.grandTotal ?? 0);
  const returnTaxableAmount = new Prisma.Decimal(returnTotals._sum.taxableAmount ?? 0);
  const returnTaxAmount = new Prisma.Decimal(returnTotals._sum.totalTaxAmount ?? 0);
  const returnGrandTotal = new Prisma.Decimal(returnTotals._sum.grandTotal ?? 0);

  return {
    approvedOrders,
    postedInvoices,
    postedReturns,
    grossTaxableAmount,
    grossTaxAmount,
    grossGrandTotal,
    returnTaxableAmount,
    returnTaxAmount,
    returnGrandTotal,
    taxableAmount: grossTaxableAmount.minus(returnTaxableAmount),
    totalTaxAmount: grossTaxAmount.minus(returnTaxAmount),
    grandTotal: grossGrandTotal.minus(returnGrandTotal),
  };
}

export async function listPurchaseOrders(companyId: string) {
  return prisma.purchaseOrder.findMany({
    where: { companyId },
    include: {
      supplier: true,
      lines: { include: { productVariant: true }, orderBy: { lineOrder: "asc" } },
    },
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
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

export async function createPurchaseOrder(context: PurchaseContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const supplierId = requiredString(data.supplierId, "Supplier");
  const orderDate = parseDate(data.orderDate);
  const expectedDate = optionalString(data.expectedDate) ? parseDate(data.expectedDate) : undefined;
  const rawLines = Array.isArray(data.lines) ? (data.lines as PurchaseLineInput[]) : [];

  if (rawLines.length === 0) {
    throw new ApiError(400, "PURCHASE_ORDER_LINES_REQUIRED", "At least one purchase order line is required.");
  }

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: supplierId, companyId: context.companyId, status: "ACTIVE" },
    });

    if (!supplier) {
      throw new ApiError(404, "SUPPLIER_NOT_FOUND", "Supplier not found or inactive.");
    }

    const orderNumber = await nextDocumentNumber(
      tx,
      context.companyId,
      "PURCHASE_ORDER",
      "Create a PURCHASE_ORDER number series before creating purchase orders.",
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
        include: { product: { include: { taxRate: true } } },
      });

      if (!variant) {
        throw new ApiError(404, "PRODUCT_VARIANT_NOT_FOUND", "Product variant not found or inactive.");
      }

      const quantity = positiveDecimal(line.quantity, "Quantity", 3);
      const unitCost = positiveDecimal(line.unitCost, "Unit cost", 2);
      const taxableAmount = quantity.mul(unitCost).toDecimalPlaces(2);
      const taxRate = variant.product.taxRate;
      const taxAmount = taxableAmount.mul(taxRate?.igstRate ?? new Prisma.Decimal(0)).div(100).toDecimalPlaces(2);

      preparedLines.push({
        companyId: context.companyId,
        productVariantId,
        quantity,
        unitCost,
        taxableAmount,
        taxAmount,
        lineTotal: taxableAmount.plus(taxAmount).toDecimalPlaces(2),
        lineOrder: index + 1,
      });
    }

    const taxableAmount = preparedLines.reduce((total, line) => total.plus(line.taxableAmount), new Prisma.Decimal(0));
    const totalTaxAmount = preparedLines.reduce((total, line) => total.plus(line.taxAmount), new Prisma.Decimal(0));
    const grandTotal = taxableAmount.plus(totalTaxAmount).toDecimalPlaces(2);
    const order = await tx.purchaseOrder.create({
      data: {
        companyId: context.companyId,
        supplierId,
        orderNumber,
        orderDate,
        expectedDate,
        taxableAmount,
        totalTaxAmount,
        grandTotal,
        status: "APPROVED",
        narration: optionalString(data.narration),
        createdByUserId: context.userId,
        lines: { create: preparedLines },
      },
      include: { supplier: true, lines: { include: { productVariant: true } } },
    });

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "purchase",
        action: "CREATE",
        entityType: "PurchaseOrder",
        entityId: order.id,
        description: "Purchase order created.",
        afterData: json(order),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return order;
  });
}

export async function listPurchaseReturns(companyId: string) {
  return prisma.purchaseReturn.findMany({
    where: { companyId },
    include: {
      supplier: true,
      warehouse: true,
      purchaseInvoice: true,
      lines: { include: { product: true, productVariant: true }, orderBy: { lineOrder: "asc" } },
    },
    orderBy: { returnDate: "desc" },
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

export async function cancelPurchaseInvoice(context: PurchaseContext, invoiceId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const reason = requiredString(data.reason, "Cancellation reason");

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.purchaseInvoice.findFirst({
      where: { id: invoiceId, companyId: context.companyId },
      include: {
        lines: true,
        journalEntry: { include: { lines: true } },
      },
    });

    if (!invoice) {
      throw new ApiError(404, "PURCHASE_INVOICE_NOT_FOUND", "Purchase invoice not found.");
    }

    if (invoice.status !== "POSTED") {
      throw new ApiError(400, "PURCHASE_INVOICE_NOT_POSTED", "Only posted purchase invoices can be cancelled.");
    }

    const journalNumber = await nextDocumentNumber(
      tx,
      context.companyId,
      "JOURNAL_ENTRY",
      "Create a JOURNAL_ENTRY number series before cancelling purchase invoices.",
    );

    for (const line of invoice.lines) {
      const key = locationKey({
        warehouseId: invoice.warehouseId,
        blockId: line.blockId ?? undefined,
        rackId: line.rackId ?? undefined,
        shelfId: line.shelfId ?? undefined,
      });
      const balance = await tx.stockBalance.findUnique({
        where: {
          companyId_productVariantId_warehouseId_locationKey: {
            companyId: context.companyId,
            productVariantId: line.productVariantId,
            warehouseId: invoice.warehouseId,
            locationKey: key,
          },
        },
      });

      if (!balance || new Prisma.Decimal(balance.quantity).lt(line.quantity)) {
        throw new ApiError(400, "PURCHASE_CANCEL_STOCK_SHORTAGE", "Purchase invoice cannot be cancelled because stock has already been consumed.");
      }

      const newQuantity = new Prisma.Decimal(balance.quantity).minus(line.quantity);
      const newValue = new Prisma.Decimal(balance.stockValue).minus(line.taxableAmount).toDecimalPlaces(2);

      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantity: newQuantity, stockValue: newValue.lt(0) ? 0 : newValue },
      });

      await tx.stockMovement.create({
        data: {
          companyId: context.companyId,
          productId: line.productId,
          productVariantId: line.productVariantId,
          warehouseId: invoice.warehouseId,
          blockId: line.blockId,
          rackId: line.rackId,
          shelfId: line.shelfId,
          locationKey: key,
          movementType: "PURCHASE_RETURN",
          documentType: "PURCHASE_INVOICE_CANCEL",
          documentNumber: invoice.invoiceNumber,
          documentDate: new Date(),
          quantityOut: line.quantity,
          unitCost: line.unitCost,
          totalValue: line.taxableAmount,
          narration: reason,
          createdByUserId: context.userId,
        },
      });
    }

    const reversalJournal = await tx.journalEntry.create({
      data: {
        companyId: context.companyId,
        entryNumber: journalNumber,
        entryDate: new Date(),
        sourceModule: "purchase",
        sourceType: "PURCHASE_INVOICE_CANCEL",
        sourceId: invoice.id,
        narration: `Cancel purchase invoice ${invoice.invoiceNumber}`,
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: {
          create: (invoice.journalEntry?.lines ?? []).map((line, index) => ({
            accountId: line.accountId,
            debitAmount: line.creditAmount,
            creditAmount: line.debitAmount,
            narration: `Reversal ${invoice.invoiceNumber}`,
            lineOrder: index + 1,
          })),
        },
      },
    });

    await tx.partyLedgerEntry.create({
      data: {
        companyId: context.companyId,
        partyType: "SUPPLIER",
        supplierId: invoice.supplierId,
        journalEntryId: reversalJournal.id,
        entryType: "ADJUSTMENT",
        documentType: "PURCHASE_INVOICE_CANCEL",
        documentId: invoice.id,
        documentNumber: invoice.invoiceNumber,
        entryDate: new Date(),
        debitAmount: invoice.grandTotal,
        narration: reason,
      },
    });

    const cancelled = await tx.purchaseInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "CANCELLED",
        cancelledByUserId: context.userId,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "purchase",
        action: "CANCEL",
        entityType: "PurchaseInvoice",
        entityId: invoice.id,
        description: "Purchase invoice cancelled.",
        beforeData: json(invoice),
        afterData: json(cancelled),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return cancelled;
  });
}

export async function postPurchaseReturn(context: PurchaseContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const purchaseInvoiceId = requiredString(data.purchaseInvoiceId, "Purchase invoice");
  const returnDate = parseDate(data.returnDate);
  const reason = requiredString(data.reason, "Reason");
  const rawLines = Array.isArray(data.lines) ? (data.lines as ReturnLineInput[]) : [];

  if (rawLines.length === 0) {
    throw new ApiError(400, "RETURN_LINES_REQUIRED", "At least one return line is required.");
  }

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.purchaseInvoice.findFirst({
      where: { id: purchaseInvoiceId, companyId: context.companyId, status: "POSTED" },
      include: { lines: true, supplier: true },
    });

    if (!invoice) {
      throw new ApiError(404, "PURCHASE_INVOICE_NOT_FOUND", "Posted purchase invoice not found.");
    }

    const inventoryAccount = await requireAccount(tx, context.companyId, "1200");
    const gstInputAccount = await requireAccount(tx, context.companyId, "2200");
    const payableAccount = await requireAccount(tx, context.companyId, "2000");
    const returnNumber = await nextDocumentNumber(
      tx,
      context.companyId,
      "PURCHASE_RETURN",
      "Create a PURCHASE_RETURN number series before posting purchase returns.",
    );
    const journalNumber = await nextDocumentNumber(
      tx,
      context.companyId,
      "JOURNAL_ENTRY",
      "Create a JOURNAL_ENTRY number series before posting purchase returns.",
    );
    const preparedLines = [];

    for (const [index, line] of rawLines.entries()) {
      const purchaseInvoiceLineId = requiredString(line.purchaseInvoiceLineId, "Purchase invoice line");
      const invoiceLine = invoice.lines.find((item) => item.id === purchaseInvoiceLineId);

      if (!invoiceLine) {
        throw new ApiError(400, "INVALID_RETURN_LINE", "Return line does not belong to the selected invoice.");
      }

      const quantity = positiveDecimal(line.quantity, "Return quantity", 3);

      if (quantity.gt(invoiceLine.quantity)) {
        throw new ApiError(400, "RETURN_QUANTITY_EXCEEDS_INVOICE", "Return quantity cannot exceed invoice quantity.");
      }

      const key = locationKey({
        warehouseId: invoice.warehouseId,
        blockId: invoiceLine.blockId ?? undefined,
        rackId: invoiceLine.rackId ?? undefined,
        shelfId: invoiceLine.shelfId ?? undefined,
      });
      const balance = await tx.stockBalance.findUnique({
        where: {
          companyId_productVariantId_warehouseId_locationKey: {
            companyId: context.companyId,
            productVariantId: invoiceLine.productVariantId,
            warehouseId: invoice.warehouseId,
            locationKey: key,
          },
        },
      });

      if (!balance || new Prisma.Decimal(balance.quantity).lt(quantity)) {
        throw new ApiError(400, "PURCHASE_RETURN_STOCK_SHORTAGE", "Purchase return quantity exceeds available stock.");
      }

      const ratio = quantity.div(invoiceLine.quantity);
      preparedLines.push({
        companyId: context.companyId,
        productId: invoiceLine.productId,
        productVariantId: invoiceLine.productVariantId,
        blockId: invoiceLine.blockId,
        rackId: invoiceLine.rackId,
        shelfId: invoiceLine.shelfId,
        locationKey: key,
        hsnCode: invoiceLine.hsnCode,
        quantity,
        unitCost: invoiceLine.unitCost,
        taxableAmount: invoiceLine.taxableAmount.mul(ratio).toDecimalPlaces(2),
        cgstAmount: invoiceLine.cgstAmount.mul(ratio).toDecimalPlaces(2),
        sgstAmount: invoiceLine.sgstAmount.mul(ratio).toDecimalPlaces(2),
        igstAmount: invoiceLine.igstAmount.mul(ratio).toDecimalPlaces(2),
        lineTotal: invoiceLine.lineTotal.mul(ratio).toDecimalPlaces(2),
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
        entryDate: returnDate,
        sourceModule: "purchase",
        sourceType: "PURCHASE_RETURN",
        narration: `Purchase return ${returnNumber}`,
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: payableAccount.id, debitAmount: grandTotal, narration: returnNumber, lineOrder: 1 },
            { accountId: inventoryAccount.id, creditAmount: taxableAmount, narration: returnNumber, lineOrder: 2 },
            ...(totalTaxAmount.gt(0)
              ? [{ accountId: gstInputAccount.id, creditAmount: totalTaxAmount, narration: returnNumber, lineOrder: 3 }]
              : []),
          ],
        },
      },
    });

    const purchaseReturn = await tx.purchaseReturn.create({
      data: {
        companyId: context.companyId,
        purchaseInvoiceId: invoice.id,
        supplierId: invoice.supplierId,
        warehouseId: invoice.warehouseId,
        returnNumber,
        returnDate,
        reason,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalTaxAmount,
        grandTotal,
        journalEntryId: journalEntry.id,
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: { create: preparedLines.map(({ locationKey: _locationKey, ...line }) => line) },
      },
      include: { supplier: true, warehouse: true, purchaseInvoice: true, lines: { include: { product: true, productVariant: true } } },
    });

    for (const line of preparedLines) {
      const balance = await tx.stockBalance.findUniqueOrThrow({
        where: {
          companyId_productVariantId_warehouseId_locationKey: {
            companyId: context.companyId,
            productVariantId: line.productVariantId,
            warehouseId: invoice.warehouseId,
            locationKey: line.locationKey,
          },
        },
      });
      const newQuantity = new Prisma.Decimal(balance.quantity).minus(line.quantity);
      const newValue = new Prisma.Decimal(balance.stockValue).minus(line.taxableAmount).toDecimalPlaces(2);

      if (newQuantity.lt(0)) {
        throw new ApiError(400, "NEGATIVE_STOCK_BLOCKED", "Purchase return posting would create negative stock.");
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
          warehouseId: invoice.warehouseId,
          blockId: line.blockId,
          rackId: line.rackId,
          shelfId: line.shelfId,
          locationKey: line.locationKey,
          movementType: "PURCHASE_RETURN",
          documentType: "PURCHASE_RETURN",
          documentNumber: returnNumber,
          documentDate: returnDate,
          quantityOut: line.quantity,
          unitCost: line.unitCost,
          totalValue: line.taxableAmount,
          narration: reason,
          createdByUserId: context.userId,
        },
      });
    }

    await tx.partyLedgerEntry.create({
      data: {
        companyId: context.companyId,
        partyType: "SUPPLIER",
        supplierId: invoice.supplierId,
        journalEntryId: journalEntry.id,
        entryType: "DEBIT_NOTE",
        documentType: "PURCHASE_RETURN",
        documentId: purchaseReturn.id,
        documentNumber: returnNumber,
        entryDate: returnDate,
        debitAmount: grandTotal,
        narration: reason,
      },
    });

    await tx.journalEntry.update({ where: { id: journalEntry.id }, data: { sourceId: purchaseReturn.id } });
    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "purchase",
        action: "POST",
        entityType: "PurchaseReturn",
        entityId: purchaseReturn.id,
        description: "Purchase return posted.",
        afterData: json(purchaseReturn),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return purchaseReturn;
  });
}
