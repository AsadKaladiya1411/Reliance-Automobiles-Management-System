import { Prisma } from "../../generated/prisma/client";
import prisma from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import type { RequestContext } from "../../types/request-context";
import { formatDocumentNumber } from "../number-series/number-series.service";

type InventoryContext = RequestContext & {
  companyId: string;
  userId: string;
};

type OpeningStockInput = {
  productVariantId: string;
  warehouseId: string;
  blockId?: string;
  rackId?: string;
  shelfId?: string;
  quantity: number;
  unitCost: number;
  documentDate?: string;
  narration?: string;
};

type StockAdjustmentInput = OpeningStockInput & {
  adjustmentType: string;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_INVENTORY_DATA", `${field} is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function positiveNumber(value: unknown, field: string) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new ApiError(400, "INVALID_INVENTORY_NUMBER", `${field} must be greater than zero.`);
  }

  return number;
}

async function requireAccount(tx: Prisma.TransactionClient, companyId: string, code: string) {
  const account = await tx.account.findFirst({ where: { companyId, code, status: "ACTIVE" } });

  if (!account) {
    throw new ApiError(400, "ACCOUNT_MISSING", `Required account ${code} is missing. Seed default accounts first.`);
  }

  return account;
}

async function nextDocumentNumber(tx: Prisma.TransactionClient, companyId: string, documentType: string) {
  const series = await tx.numberSeries.findFirst({
    where: { companyId, documentType, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });

  if (!series) {
    throw new ApiError(400, "NUMBER_SERIES_MISSING", `Create a ${documentType} number series before posting inventory adjustments.`);
  }

  await tx.numberSeries.update({ where: { id: series.id }, data: { nextNumber: { increment: 1 } } });
  return formatDocumentNumber(series);
}

function parseDate(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "INVALID_DATE", "Document date is invalid.");
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

async function validateLocation(
  companyId: string,
  input: Pick<OpeningStockInput, "warehouseId" | "blockId" | "rackId" | "shelfId">,
) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: input.warehouseId, companyId, status: "ACTIVE" },
  });

  if (!warehouse) {
    throw new ApiError(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found or inactive.");
  }

  if (input.blockId) {
    const block = await prisma.warehouseBlock.findFirst({
      where: { id: input.blockId, warehouseId: input.warehouseId, status: "ACTIVE" },
    });
    if (!block) {
      throw new ApiError(404, "WAREHOUSE_BLOCK_NOT_FOUND", "Warehouse block not found or inactive.");
    }
  }

  if (input.rackId) {
    const rack = await prisma.warehouseRack.findFirst({
      where: {
        id: input.rackId,
        status: "ACTIVE",
        block: {
          warehouseId: input.warehouseId,
          ...(input.blockId ? { id: input.blockId } : {}),
        },
      },
    });
    if (!rack) {
      throw new ApiError(404, "WAREHOUSE_RACK_NOT_FOUND", "Warehouse rack not found or inactive.");
    }
  }

  if (input.shelfId) {
    const shelf = await prisma.warehouseShelf.findFirst({
      where: {
        id: input.shelfId,
        status: "ACTIVE",
        rack: {
          block: {
            warehouseId: input.warehouseId,
          },
          ...(input.rackId ? { id: input.rackId } : {}),
        },
      },
    });
    if (!shelf) {
      throw new ApiError(404, "WAREHOUSE_SHELF_NOT_FOUND", "Warehouse shelf not found or inactive.");
    }
  }
}

export async function getInventorySummary(companyId: string) {
  const [stockItems, movementCount, totalValue] = await Promise.all([
    prisma.stockBalance.count({ where: { companyId, quantity: { gt: 0 } } }),
    prisma.stockMovement.count({ where: { companyId } }),
    prisma.stockBalance.aggregate({
      where: { companyId },
      _sum: { stockValue: true, quantity: true },
    }),
  ]);

  return {
    stockItems,
    movementCount,
    totalQuantity: totalValue._sum.quantity ?? 0,
    stockValue: totalValue._sum.stockValue ?? 0,
  };
}

export async function listStockBalances(companyId: string) {
  return prisma.stockBalance.findMany({
    where: { companyId },
    include: {
      product: true,
      productVariant: true,
      warehouse: true,
      block: true,
      rack: true,
      shelf: true,
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function listStockMovements(companyId: string) {
  return prisma.stockMovement.findMany({
    where: { companyId },
    include: {
      product: true,
      productVariant: true,
      warehouse: true,
      block: true,
      rack: true,
      shelf: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });
}

export async function postOpeningStock(context: InventoryContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const input: OpeningStockInput = {
    productVariantId: requiredString(data.productVariantId, "Product variant"),
    warehouseId: requiredString(data.warehouseId, "Warehouse"),
    blockId: optionalString(data.blockId),
    rackId: optionalString(data.rackId),
    shelfId: optionalString(data.shelfId),
    quantity: positiveNumber(data.quantity, "Quantity"),
    unitCost: positiveNumber(data.unitCost, "Unit cost"),
    documentDate: optionalString(data.documentDate),
    narration: optionalString(data.narration),
  };

  const productVariant = await prisma.productVariant.findFirst({
    where: {
      id: input.productVariantId,
      companyId: context.companyId,
      status: "ACTIVE",
      product: { status: "ACTIVE" },
    },
    include: { product: true },
  });

  if (!productVariant) {
    throw new ApiError(404, "PRODUCT_VARIANT_NOT_FOUND", "Product variant not found or inactive.");
  }

  await validateLocation(context.companyId, input);

  const key = locationKey(input);
  const documentDate = parseDate(input.documentDate);
  const totalValue = Number((input.quantity * input.unitCost).toFixed(2));

  return prisma.$transaction(async (tx) => {
    const series = await tx.numberSeries.findFirst({
      where: {
        companyId: context.companyId,
        documentType: "OPENING_STOCK",
        status: "ACTIVE",
      },
      orderBy: { createdAt: "asc" },
    });
    const documentNumber = series
      ? `${series.prefix}${String(series.nextNumber).padStart(series.padding, "0")}${series.suffix}`
      : `OS-${String(
          (await tx.stockMovement.count({
            where: { companyId: context.companyId, documentType: "OPENING_STOCK" },
          })) + 1,
        ).padStart(5, "0")}`;

    if (series) {
      await tx.numberSeries.update({
        where: { id: series.id },
        data: { nextNumber: { increment: 1 } },
      });
    }

    const existingBalance = await tx.stockBalance.findUnique({
      where: {
        companyId_productVariantId_warehouseId_locationKey: {
          companyId: context.companyId,
          productVariantId: input.productVariantId,
          warehouseId: input.warehouseId,
          locationKey: key,
        },
      },
    });

    const existingQuantity = Number(existingBalance?.quantity ?? 0);
    const existingValue = Number(existingBalance?.stockValue ?? 0);
    const newQuantity = existingQuantity + input.quantity;
    const newValue = Number((existingValue + totalValue).toFixed(2));
    const averageCost = Number((newValue / newQuantity).toFixed(2));

    const balance = await tx.stockBalance.upsert({
      where: {
        companyId_productVariantId_warehouseId_locationKey: {
          companyId: context.companyId,
          productVariantId: input.productVariantId,
          warehouseId: input.warehouseId,
          locationKey: key,
        },
      },
      create: {
        companyId: context.companyId,
        productId: productVariant.productId,
        productVariantId: input.productVariantId,
        warehouseId: input.warehouseId,
        blockId: input.blockId,
        rackId: input.rackId,
        shelfId: input.shelfId,
        locationKey: key,
        quantity: input.quantity,
        averageCost: input.unitCost,
        stockValue: totalValue,
      },
      update: {
        quantity: newQuantity,
        averageCost,
        stockValue: newValue,
      },
    });

    const movement = await tx.stockMovement.create({
      data: {
        companyId: context.companyId,
        productId: productVariant.productId,
        productVariantId: input.productVariantId,
        warehouseId: input.warehouseId,
        blockId: input.blockId,
        rackId: input.rackId,
        shelfId: input.shelfId,
        locationKey: key,
        movementType: "OPENING_STOCK",
        documentType: "OPENING_STOCK",
        documentNumber,
        documentDate,
        quantityIn: input.quantity,
        unitCost: input.unitCost,
        totalValue,
        narration: input.narration,
        createdByUserId: context.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "inventory",
        action: "POST",
        entityType: "StockMovement",
        entityId: movement.id,
        description: "Opening stock posted.",
        afterData: {
          movement,
          balance,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return {
      documentNumber,
      movement,
      balance,
    };
  });
}

export async function postStockAdjustment(context: InventoryContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const input: StockAdjustmentInput = {
    adjustmentType: requiredString(data.adjustmentType, "Adjustment type").toUpperCase(),
    productVariantId: requiredString(data.productVariantId, "Product variant"),
    warehouseId: requiredString(data.warehouseId, "Warehouse"),
    blockId: optionalString(data.blockId),
    rackId: optionalString(data.rackId),
    shelfId: optionalString(data.shelfId),
    quantity: positiveNumber(data.quantity, "Quantity"),
    unitCost: positiveNumber(data.unitCost, "Unit cost"),
    documentDate: optionalString(data.documentDate),
    narration: optionalString(data.narration),
  };

  if (!["IN", "OUT"].includes(input.adjustmentType)) {
    throw new ApiError(400, "INVALID_ADJUSTMENT_TYPE", "Adjustment type must be IN or OUT.");
  }

  const productVariant = await prisma.productVariant.findFirst({
    where: {
      id: input.productVariantId,
      companyId: context.companyId,
      status: "ACTIVE",
      product: { status: "ACTIVE" },
    },
    include: { product: true },
  });

  if (!productVariant) {
    throw new ApiError(404, "PRODUCT_VARIANT_NOT_FOUND", "Product variant not found or inactive.");
  }

  await validateLocation(context.companyId, input);

  const key = locationKey(input);
  const documentDate = parseDate(input.documentDate);
  const totalValue = Number((input.quantity * input.unitCost).toFixed(2));

  return prisma.$transaction(async (tx) => {
    const inventoryAccount = await requireAccount(tx, context.companyId, "1200");
    const adjustmentAccount = await requireAccount(tx, context.companyId, "5100");
    const documentNumber = await nextDocumentNumber(tx, context.companyId, "STOCK_ADJUSTMENT");
    const journalNumber = await nextDocumentNumber(tx, context.companyId, "JOURNAL_ENTRY");
    const existingBalance = await tx.stockBalance.findUnique({
      where: {
        companyId_productVariantId_warehouseId_locationKey: {
          companyId: context.companyId,
          productVariantId: input.productVariantId,
          warehouseId: input.warehouseId,
          locationKey: key,
        },
      },
    });
    const existingQuantity = Number(existingBalance?.quantity ?? 0);
    const existingValue = Number(existingBalance?.stockValue ?? 0);
    const isIncrease = input.adjustmentType === "IN";
    const newQuantity = isIncrease ? existingQuantity + input.quantity : existingQuantity - input.quantity;

    if (newQuantity < 0) {
      throw new ApiError(400, "NEGATIVE_STOCK_BLOCKED", "Stock adjustment would create negative stock.");
    }

    const newValue = Number((isIncrease ? existingValue + totalValue : Math.max(existingValue - totalValue, 0)).toFixed(2));
    const averageCost = newQuantity > 0 ? Number((newValue / newQuantity).toFixed(2)) : 0;
    const balance = await tx.stockBalance.upsert({
      where: {
        companyId_productVariantId_warehouseId_locationKey: {
          companyId: context.companyId,
          productVariantId: input.productVariantId,
          warehouseId: input.warehouseId,
          locationKey: key,
        },
      },
      create: {
        companyId: context.companyId,
        productId: productVariant.productId,
        productVariantId: input.productVariantId,
        warehouseId: input.warehouseId,
        blockId: input.blockId,
        rackId: input.rackId,
        shelfId: input.shelfId,
        locationKey: key,
        quantity: isIncrease ? input.quantity : 0,
        averageCost: isIncrease ? input.unitCost : 0,
        stockValue: isIncrease ? totalValue : 0,
      },
      update: { quantity: newQuantity, averageCost, stockValue: newValue },
    });
    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId: context.companyId,
        entryNumber: journalNumber,
        entryDate: documentDate,
        sourceModule: "inventory",
        sourceType: isIncrease ? "STOCK_ADJUSTMENT_IN" : "STOCK_ADJUSTMENT_OUT",
        narration: input.narration ?? documentNumber,
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: {
          create: isIncrease
            ? [
                { accountId: inventoryAccount.id, debitAmount: totalValue, narration: documentNumber, lineOrder: 1 },
                { accountId: adjustmentAccount.id, creditAmount: totalValue, narration: documentNumber, lineOrder: 2 },
              ]
            : [
                { accountId: adjustmentAccount.id, debitAmount: totalValue, narration: documentNumber, lineOrder: 1 },
                { accountId: inventoryAccount.id, creditAmount: totalValue, narration: documentNumber, lineOrder: 2 },
              ],
        },
      },
    });
    const movement = await tx.stockMovement.create({
      data: {
        companyId: context.companyId,
        productId: productVariant.productId,
        productVariantId: input.productVariantId,
        warehouseId: input.warehouseId,
        blockId: input.blockId,
        rackId: input.rackId,
        shelfId: input.shelfId,
        locationKey: key,
        movementType: isIncrease ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        documentType: "STOCK_ADJUSTMENT",
        documentNumber,
        documentDate,
        quantityIn: isIncrease ? input.quantity : 0,
        quantityOut: isIncrease ? 0 : input.quantity,
        unitCost: input.unitCost,
        totalValue,
        narration: input.narration,
        createdByUserId: context.userId,
      },
    });

    await tx.journalEntry.update({ where: { id: journalEntry.id }, data: { sourceId: movement.id } });
    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "inventory",
        action: "POST",
        entityType: "StockAdjustment",
        entityId: movement.id,
        description: "Stock adjustment posted.",
        afterData: { movement, balance, journalEntry },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return { documentNumber, movement, balance, journalEntry };
  });
}
