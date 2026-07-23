import prisma from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import type { RequestContext } from "../../types/request-context";
import { writeAuditLog } from "../audit/audit.service";

type MasterContext = RequestContext & {
  companyId: string;
  userId: string;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_MASTER_DATA", `${field} is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function decimalNumber(value: unknown, fallback = 0) {
  const number = value === undefined || value === null || value === "" ? fallback : Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new ApiError(400, "INVALID_NUMBER", "Numeric values must be non-negative.");
  }

  return number;
}

async function auditCreate(context: MasterContext, entityType: string, entityId: string, data: unknown) {
  await writeAuditLog({
    ...context,
    module: "masters",
    action: "CREATE",
    entityType,
    entityId,
    description: `${entityType} created.`,
    afterData: data,
  });
}

export async function getMasterSummary(companyId: string) {
  const [
    units,
    hsnCodes,
    taxRates,
    brands,
    categories,
    subCategories,
    products,
    productVariants,
    warehouses,
  ] = await Promise.all([
    prisma.unit.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.hsnCode.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.taxRate.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.brand.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.category.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.subCategory.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.product.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.productVariant.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.warehouse.count({ where: { companyId, status: "ACTIVE" } }),
  ]);

  return {
    units,
    hsnCodes,
    taxRates,
    brands,
    categories,
    subCategories,
    products,
    productVariants,
    warehouses,
  };
}

export async function listUnits(companyId: string) {
  return prisma.unit.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}

export async function createUnit(context: MasterContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const unit = await prisma.unit.create({
    data: {
      companyId: context.companyId,
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      symbol: requiredString(data.symbol, "Symbol"),
    },
  });
  await auditCreate(context, "Unit", unit.id, unit);
  return unit;
}

export async function listHsnCodes(companyId: string) {
  return prisma.hsnCode.findMany({ where: { companyId }, orderBy: { code: "asc" } });
}

export async function createHsnCode(context: MasterContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const code = requiredString(data.code, "HSN code");

  if (!/^\d{4}(\d{2})?(\d{2})?$/.test(code)) {
    throw new ApiError(400, "INVALID_HSN", "HSN code must be 4, 6, or 8 digits.");
  }

  const hsnCode = await prisma.hsnCode.create({
    data: {
      companyId: context.companyId,
      code,
      description: requiredString(data.description, "Description"),
    },
  });
  await auditCreate(context, "HsnCode", hsnCode.id, hsnCode);
  return hsnCode;
}

export async function listTaxRates(companyId: string) {
  return prisma.taxRate.findMany({ where: { companyId }, orderBy: { effectiveFrom: "desc" } });
}

export async function createTaxRate(context: MasterContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const cgstRate = decimalNumber(data.cgstRate);
  const sgstRate = decimalNumber(data.sgstRate);
  const igstRate = decimalNumber(data.igstRate);

  if (Number((cgstRate + sgstRate).toFixed(2)) !== igstRate) {
    throw new ApiError(400, "INVALID_GST_RATE", "IGST must equal CGST plus SGST.");
  }

  const effectiveFrom = data.effectiveFrom ? new Date(String(data.effectiveFrom)) : new Date();

  if (Number.isNaN(effectiveFrom.getTime())) {
    throw new ApiError(400, "INVALID_DATE", "Effective date is invalid.");
  }

  const taxRate = await prisma.taxRate.create({
    data: {
      companyId: context.companyId,
      hsnCodeId: optionalString(data.hsnCodeId),
      name: requiredString(data.name, "Name"),
      cgstRate,
      sgstRate,
      igstRate,
      cessRate: decimalNumber(data.cessRate),
      effectiveFrom,
    },
  });
  await auditCreate(context, "TaxRate", taxRate.id, taxRate);
  return taxRate;
}

export async function listBrands(companyId: string) {
  return prisma.brand.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}

export async function createBrand(context: MasterContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const brand = await prisma.brand.create({
    data: {
      companyId: context.companyId,
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      description: optionalString(data.description),
    },
  });
  await auditCreate(context, "Brand", brand.id, brand);
  return brand;
}

export async function listCategories(companyId: string) {
  return prisma.category.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}

export async function createCategory(context: MasterContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const category = await prisma.category.create({
    data: {
      companyId: context.companyId,
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      description: optionalString(data.description),
    },
  });
  await auditCreate(context, "Category", category.id, category);
  return category;
}

export async function listSubCategories(companyId: string) {
  return prisma.subCategory.findMany({
    where: { companyId },
    include: { category: true },
    orderBy: { name: "asc" },
  });
}

export async function createSubCategory(context: MasterContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const subCategory = await prisma.subCategory.create({
    data: {
      companyId: context.companyId,
      categoryId: requiredString(data.categoryId, "Category"),
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      description: optionalString(data.description),
    },
  });
  await auditCreate(context, "SubCategory", subCategory.id, subCategory);
  return subCategory;
}

export async function listProducts(companyId: string) {
  return prisma.product.findMany({
    where: { companyId },
    include: { brand: true, category: true, subCategory: true, unit: true, hsnCode: true, taxRate: true },
    orderBy: { name: "asc" },
  });
}

export async function createProduct(context: MasterContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const product = await prisma.product.create({
    data: {
      companyId: context.companyId,
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      description: optionalString(data.description),
      brandId: optionalString(data.brandId),
      categoryId: requiredString(data.categoryId, "Category"),
      subCategoryId: optionalString(data.subCategoryId),
      unitId: requiredString(data.unitId, "Unit"),
      hsnCodeId: optionalString(data.hsnCodeId),
      taxRateId: optionalString(data.taxRateId),
      trackingType: (optionalString(data.trackingType) ?? "NONE") as "NONE" | "BATCH" | "SERIAL",
      reorderLevel: decimalNumber(data.reorderLevel),
    },
  });
  await auditCreate(context, "Product", product.id, product);
  return product;
}

export async function listWarehouses(companyId: string) {
  return prisma.warehouse.findMany({
    where: { companyId },
    include: {
      blocks: {
        include: {
          racks: {
            include: {
              shelves: true,
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createWarehouse(context: MasterContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const warehouse = await prisma.warehouse.create({
    data: {
      companyId: context.companyId,
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      address: optionalString(data.address),
    },
  });
  await auditCreate(context, "Warehouse", warehouse.id, warehouse);
  return warehouse;
}

export async function createWarehouseBlock(context: MasterContext, warehouseId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, companyId: context.companyId },
  });

  if (!warehouse) {
    throw new ApiError(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found.");
  }

  const block = await prisma.warehouseBlock.create({
    data: {
      warehouseId,
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      blockType: optionalString(data.blockType) ?? "Storage",
    },
  });
  await auditCreate(context, "WarehouseBlock", block.id, block);
  return block;
}

export async function createWarehouseRack(context: MasterContext, blockId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const block = await prisma.warehouseBlock.findFirst({
    where: { id: blockId, warehouse: { companyId: context.companyId } },
  });

  if (!block) {
    throw new ApiError(404, "WAREHOUSE_BLOCK_NOT_FOUND", "Warehouse block not found.");
  }

  const shelfCount = Number(data.shelfCount ?? 1);

  if (!Number.isInteger(shelfCount) || shelfCount < 1 || shelfCount > 50) {
    throw new ApiError(400, "INVALID_SHELF_COUNT", "Shelf count must be between 1 and 50.");
  }

  const rack = await prisma.warehouseRack.create({
    data: {
      blockId,
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      rackType: optionalString(data.rackType) ?? "Open",
      shelfCount,
    },
  });
  await auditCreate(context, "WarehouseRack", rack.id, rack);
  return rack;
}

export async function createWarehouseShelf(context: MasterContext, rackId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const rack = await prisma.warehouseRack.findFirst({
    where: { id: rackId, block: { warehouse: { companyId: context.companyId } } },
  });

  if (!rack) {
    throw new ApiError(404, "WAREHOUSE_RACK_NOT_FOUND", "Warehouse rack not found.");
  }

  const shelf = await prisma.warehouseShelf.create({
    data: {
      rackId,
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      barcode: optionalString(data.barcode),
    },
  });
  await auditCreate(context, "WarehouseShelf", shelf.id, shelf);
  return shelf;
}
