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

async function auditUpdate(context: MasterContext, entityType: string, entityId: string, beforeData: unknown, afterData: unknown) {
  await writeAuditLog({
    ...context,
    module: "masters",
    action: "UPDATE",
    entityType,
    entityId,
    description: `${entityType} updated.`,
    beforeData,
    afterData,
  });
}

async function auditDeactivate(context: MasterContext, entityType: string, entityId: string, beforeData: unknown, afterData: unknown) {
  await writeAuditLog({
    ...context,
    module: "masters",
    action: "DELETE",
    entityType,
    entityId,
    description: `${entityType} deactivated.`,
    beforeData,
    afterData,
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

export async function updateUnit(context: MasterContext, unitId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.unit.findFirst({ where: { id: unitId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "UNIT_NOT_FOUND", "Unit not found.");
  }

  const updated = await prisma.unit.update({
    where: { id: existing.id },
    data: {
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      symbol: requiredString(data.symbol, "Symbol"),
    },
  });
  await auditUpdate(context, "Unit", updated.id, existing, updated);
  return updated;
}

export async function deactivateUnit(context: MasterContext, unitId: string) {
  const existing = await prisma.unit.findFirst({ where: { id: unitId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "UNIT_NOT_FOUND", "Unit not found.");
  }

  const inUse = await prisma.product.count({ where: { companyId: context.companyId, unitId } });

  if (inUse > 0) {
    throw new ApiError(400, "MASTER_IN_USE", "Unit is used by products and cannot be deactivated.");
  }

  const updated = await prisma.unit.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "Unit", updated.id, existing, updated);
  return updated;
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

export async function updateHsnCode(context: MasterContext, hsnCodeId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.hsnCode.findFirst({ where: { id: hsnCodeId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "HSN_CODE_NOT_FOUND", "HSN code not found.");
  }

  const code = requiredString(data.code, "HSN code");

  if (!/^\d{4}(\d{2})?(\d{2})?$/.test(code)) {
    throw new ApiError(400, "INVALID_HSN", "HSN code must be 4, 6, or 8 digits.");
  }

  const updated = await prisma.hsnCode.update({
    where: { id: existing.id },
    data: {
      code,
      description: requiredString(data.description, "Description"),
    },
  });
  await auditUpdate(context, "HsnCode", updated.id, existing, updated);
  return updated;
}

export async function deactivateHsnCode(context: MasterContext, hsnCodeId: string) {
  const existing = await prisma.hsnCode.findFirst({ where: { id: hsnCodeId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "HSN_CODE_NOT_FOUND", "HSN code not found.");
  }

  const inUse = await prisma.product.count({ where: { companyId: context.companyId, hsnCodeId } });

  if (inUse > 0) {
    throw new ApiError(400, "MASTER_IN_USE", "HSN code is used by products and cannot be deactivated.");
  }

  const updated = await prisma.hsnCode.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "HsnCode", updated.id, existing, updated);
  return updated;
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

export async function updateTaxRate(context: MasterContext, taxRateId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.taxRate.findFirst({ where: { id: taxRateId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "TAX_RATE_NOT_FOUND", "Tax rate not found.");
  }

  const cgstRate = decimalNumber(data.cgstRate);
  const sgstRate = decimalNumber(data.sgstRate);
  const igstRate = decimalNumber(data.igstRate);

  if (Number((cgstRate + sgstRate).toFixed(2)) !== igstRate) {
    throw new ApiError(400, "INVALID_GST_RATE", "IGST must equal CGST plus SGST.");
  }

  const effectiveFrom = data.effectiveFrom ? new Date(String(data.effectiveFrom)) : existing.effectiveFrom;

  if (Number.isNaN(effectiveFrom.getTime())) {
    throw new ApiError(400, "INVALID_DATE", "Effective date is invalid.");
  }

  const updated = await prisma.taxRate.update({
    where: { id: existing.id },
    data: {
      hsnCodeId: optionalString(data.hsnCodeId),
      name: requiredString(data.name, "Name"),
      cgstRate,
      sgstRate,
      igstRate,
      cessRate: decimalNumber(data.cessRate),
      effectiveFrom,
    },
  });
  await auditUpdate(context, "TaxRate", updated.id, existing, updated);
  return updated;
}

export async function deactivateTaxRate(context: MasterContext, taxRateId: string) {
  const existing = await prisma.taxRate.findFirst({ where: { id: taxRateId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "TAX_RATE_NOT_FOUND", "Tax rate not found.");
  }

  const inUse = await prisma.product.count({ where: { companyId: context.companyId, taxRateId } });

  if (inUse > 0) {
    throw new ApiError(400, "MASTER_IN_USE", "Tax rate is used by products and cannot be deactivated.");
  }

  const updated = await prisma.taxRate.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "TaxRate", updated.id, existing, updated);
  return updated;
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

export async function updateBrand(context: MasterContext, brandId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.brand.findFirst({ where: { id: brandId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "BRAND_NOT_FOUND", "Brand not found.");
  }

  const updated = await prisma.brand.update({
    where: { id: existing.id },
    data: {
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      description: optionalString(data.description),
    },
  });
  await auditUpdate(context, "Brand", updated.id, existing, updated);
  return updated;
}

export async function deactivateBrand(context: MasterContext, brandId: string) {
  const existing = await prisma.brand.findFirst({ where: { id: brandId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "BRAND_NOT_FOUND", "Brand not found.");
  }

  const inUse = await prisma.product.count({ where: { companyId: context.companyId, brandId } });

  if (inUse > 0) {
    throw new ApiError(400, "MASTER_IN_USE", "Brand is used by products and cannot be deactivated.");
  }

  const updated = await prisma.brand.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "Brand", updated.id, existing, updated);
  return updated;
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

export async function updateCategory(context: MasterContext, categoryId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.category.findFirst({ where: { id: categoryId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found.");
  }

  const updated = await prisma.category.update({
    where: { id: existing.id },
    data: {
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      description: optionalString(data.description),
    },
  });
  await auditUpdate(context, "Category", updated.id, existing, updated);
  return updated;
}

export async function deactivateCategory(context: MasterContext, categoryId: string) {
  const existing = await prisma.category.findFirst({ where: { id: categoryId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found.");
  }

  const [productCount, subCategoryCount] = await Promise.all([
    prisma.product.count({ where: { companyId: context.companyId, categoryId } }),
    prisma.subCategory.count({ where: { companyId: context.companyId, categoryId } }),
  ]);

  if (productCount > 0 || subCategoryCount > 0) {
    throw new ApiError(400, "MASTER_IN_USE", "Category is used by products or sub-categories and cannot be deactivated.");
  }

  const updated = await prisma.category.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "Category", updated.id, existing, updated);
  return updated;
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

export async function updateProduct(context: MasterContext, productId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.product.findFirst({ where: { id: productId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  }

  const updated = await prisma.product.update({
    where: { id: existing.id },
    data: {
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      description: optionalString(data.description),
      brandId: optionalString(data.brandId),
      categoryId: requiredString(data.categoryId, "Category"),
      subCategoryId: optionalString(data.subCategoryId),
      unitId: requiredString(data.unitId, "Unit"),
      hsnCodeId: optionalString(data.hsnCodeId),
      taxRateId: optionalString(data.taxRateId),
      trackingType: (optionalString(data.trackingType) ?? existing.trackingType) as "NONE" | "BATCH" | "SERIAL",
      reorderLevel: decimalNumber(data.reorderLevel),
    },
    include: { brand: true, category: true, subCategory: true, unit: true, hsnCode: true, taxRate: true },
  });
  await auditUpdate(context, "Product", updated.id, existing, updated);
  return updated;
}

export async function deactivateProduct(context: MasterContext, productId: string) {
  const existing = await prisma.product.findFirst({ where: { id: productId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  }

  const [
    variants,
    stockBalances,
    stockMovements,
    purchaseInvoiceLines,
    purchaseReturnLines,
    salesInvoiceLines,
    salesReturnLines,
  ] = await Promise.all([
    prisma.productVariant.count({ where: { companyId: context.companyId, productId } }),
    prisma.stockBalance.count({ where: { companyId: context.companyId, productId } }),
    prisma.stockMovement.count({ where: { companyId: context.companyId, productId } }),
    prisma.purchaseInvoiceLine.count({ where: { companyId: context.companyId, productId } }),
    prisma.purchaseReturnLine.count({ where: { companyId: context.companyId, productId } }),
    prisma.salesInvoiceLine.count({ where: { companyId: context.companyId, productId } }),
    prisma.salesReturnLine.count({ where: { companyId: context.companyId, productId } }),
  ]);

  if ([variants, stockBalances, stockMovements, purchaseInvoiceLines, purchaseReturnLines, salesInvoiceLines, salesReturnLines].some((count) => count > 0)) {
    throw new ApiError(400, "MASTER_IN_USE", "Product has variants, stock, or transaction history and cannot be deactivated.");
  }

  const updated = await prisma.product.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "Product", updated.id, existing, updated);
  return updated;
}

export async function listProductVariants(companyId: string) {
  return prisma.productVariant.findMany({
    where: { companyId },
    include: { product: true },
    orderBy: { name: "asc" },
  });
}

export async function createProductVariant(context: MasterContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const productId = requiredString(data.productId, "Product");
  const product = await prisma.product.findFirst({
    where: { id: productId, companyId: context.companyId, status: "ACTIVE" },
  });

  if (!product) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found or inactive.");
  }

  const variant = await prisma.productVariant.create({
    data: {
      companyId: context.companyId,
      productId,
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      barcode: optionalString(data.barcode),
      salePrice: decimalNumber(data.salePrice),
      purchasePrice: decimalNumber(data.purchasePrice),
    },
  });
  await auditCreate(context, "ProductVariant", variant.id, variant);
  return variant;
}

export async function updateProductVariant(context: MasterContext, variantId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.productVariant.findFirst({ where: { id: variantId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "PRODUCT_VARIANT_NOT_FOUND", "Product variant not found.");
  }

  const productId = requiredString(data.productId, "Product");
  const product = await prisma.product.findFirst({
    where: { id: productId, companyId: context.companyId, status: "ACTIVE" },
  });

  if (!product) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found or inactive.");
  }

  const updated = await prisma.productVariant.update({
    where: { id: existing.id },
    data: {
      productId,
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      barcode: optionalString(data.barcode),
      salePrice: decimalNumber(data.salePrice),
      purchasePrice: decimalNumber(data.purchasePrice),
    },
    include: { product: true },
  });
  await auditUpdate(context, "ProductVariant", updated.id, existing, updated);
  return updated;
}

export async function deactivateProductVariant(context: MasterContext, variantId: string) {
  const existing = await prisma.productVariant.findFirst({ where: { id: variantId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "PRODUCT_VARIANT_NOT_FOUND", "Product variant not found.");
  }

  const [
    stockBalances,
    stockMovements,
    purchaseOrders,
    grns,
    purchaseInvoiceLines,
    purchaseReturnLines,
    salesQuotations,
    salesOrders,
    challans,
    salesInvoiceLines,
    salesReturnLines,
    jobCardParts,
  ] = await Promise.all([
    prisma.stockBalance.count({ where: { companyId: context.companyId, productVariantId: variantId } }),
    prisma.stockMovement.count({ where: { companyId: context.companyId, productVariantId: variantId } }),
    prisma.purchaseOrderLine.count({ where: { companyId: context.companyId, productVariantId: variantId } }),
    prisma.goodsReceiptNoteLine.count({ where: { companyId: context.companyId, productVariantId: variantId } }),
    prisma.purchaseInvoiceLine.count({ where: { companyId: context.companyId, productVariantId: variantId } }),
    prisma.purchaseReturnLine.count({ where: { companyId: context.companyId, productVariantId: variantId } }),
    prisma.salesQuotationLine.count({ where: { companyId: context.companyId, productVariantId: variantId } }),
    prisma.salesOrderLine.count({ where: { companyId: context.companyId, productVariantId: variantId } }),
    prisma.deliveryChallanLine.count({ where: { companyId: context.companyId, productVariantId: variantId } }),
    prisma.salesInvoiceLine.count({ where: { companyId: context.companyId, productVariantId: variantId } }),
    prisma.salesReturnLine.count({ where: { companyId: context.companyId, productVariantId: variantId } }),
    prisma.jobCardPart.count({ where: { productVariantId: variantId, jobCard: { companyId: context.companyId } } }),
  ]);

  if ([stockBalances, stockMovements, purchaseOrders, grns, purchaseInvoiceLines, purchaseReturnLines, salesQuotations, salesOrders, challans, salesInvoiceLines, salesReturnLines, jobCardParts].some((count) => count > 0)) {
    throw new ApiError(400, "MASTER_IN_USE", "Product variant has stock or transaction history and cannot be deactivated.");
  }

  const updated = await prisma.productVariant.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "ProductVariant", updated.id, existing, updated);
  return updated;
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

export async function updateWarehouse(context: MasterContext, warehouseId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.warehouse.findFirst({ where: { id: warehouseId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found.");
  }

  const updated = await prisma.warehouse.update({
    where: { id: existing.id },
    data: {
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      address: optionalString(data.address),
    },
  });
  await auditUpdate(context, "Warehouse", updated.id, existing, updated);
  return updated;
}

export async function deactivateWarehouse(context: MasterContext, warehouseId: string) {
  const existing = await prisma.warehouse.findFirst({ where: { id: warehouseId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found.");
  }

  const [stockBalanceCount, movementCount] = await Promise.all([
    prisma.stockBalance.count({ where: { companyId: context.companyId, warehouseId, quantity: { gt: 0 } } }),
    prisma.stockMovement.count({ where: { companyId: context.companyId, warehouseId } }),
  ]);

  if (stockBalanceCount > 0 || movementCount > 0) {
    throw new ApiError(400, "MASTER_IN_USE", "Warehouse has stock or movements and cannot be deactivated.");
  }

  const updated = await prisma.warehouse.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "Warehouse", updated.id, existing, updated);
  return updated;
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

export async function updateWarehouseBlock(context: MasterContext, blockId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.warehouseBlock.findFirst({
    where: { id: blockId, warehouse: { companyId: context.companyId } },
  });

  if (!existing) {
    throw new ApiError(404, "WAREHOUSE_BLOCK_NOT_FOUND", "Warehouse block not found.");
  }

  const updated = await prisma.warehouseBlock.update({
    where: { id: existing.id },
    data: {
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      blockType: optionalString(data.blockType) ?? "Storage",
    },
  });
  await auditUpdate(context, "WarehouseBlock", updated.id, existing, updated);
  return updated;
}

export async function deactivateWarehouseBlock(context: MasterContext, blockId: string) {
  const existing = await prisma.warehouseBlock.findFirst({
    where: { id: blockId, warehouse: { companyId: context.companyId } },
  });

  if (!existing) {
    throw new ApiError(404, "WAREHOUSE_BLOCK_NOT_FOUND", "Warehouse block not found.");
  }

  const [racks, balances, movements, purchaseLines, salesLines] = await Promise.all([
    prisma.warehouseRack.count({ where: { blockId } }),
    prisma.stockBalance.count({ where: { companyId: context.companyId, blockId } }),
    prisma.stockMovement.count({ where: { companyId: context.companyId, blockId } }),
    prisma.purchaseInvoiceLine.count({ where: { companyId: context.companyId, blockId } }),
    prisma.salesInvoiceLine.count({ where: { companyId: context.companyId, blockId } }),
  ]);

  if ([racks, balances, movements, purchaseLines, salesLines].some((count) => count > 0)) {
    throw new ApiError(400, "MASTER_IN_USE", "Warehouse block has racks, stock, or transaction history and cannot be deactivated.");
  }

  const updated = await prisma.warehouseBlock.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "WarehouseBlock", updated.id, existing, updated);
  return updated;
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

export async function updateWarehouseRack(context: MasterContext, rackId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.warehouseRack.findFirst({
    where: { id: rackId, block: { warehouse: { companyId: context.companyId } } },
  });

  if (!existing) {
    throw new ApiError(404, "WAREHOUSE_RACK_NOT_FOUND", "Warehouse rack not found.");
  }

  const shelfCount = Number(data.shelfCount ?? existing.shelfCount);

  if (!Number.isInteger(shelfCount) || shelfCount < 1 || shelfCount > 50) {
    throw new ApiError(400, "INVALID_SHELF_COUNT", "Shelf count must be between 1 and 50.");
  }

  const updated = await prisma.warehouseRack.update({
    where: { id: existing.id },
    data: {
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      rackType: optionalString(data.rackType) ?? "Open",
      shelfCount,
    },
  });
  await auditUpdate(context, "WarehouseRack", updated.id, existing, updated);
  return updated;
}

export async function deactivateWarehouseRack(context: MasterContext, rackId: string) {
  const existing = await prisma.warehouseRack.findFirst({
    where: { id: rackId, block: { warehouse: { companyId: context.companyId } } },
  });

  if (!existing) {
    throw new ApiError(404, "WAREHOUSE_RACK_NOT_FOUND", "Warehouse rack not found.");
  }

  const [shelves, balances, movements, purchaseLines, salesLines] = await Promise.all([
    prisma.warehouseShelf.count({ where: { rackId } }),
    prisma.stockBalance.count({ where: { companyId: context.companyId, rackId } }),
    prisma.stockMovement.count({ where: { companyId: context.companyId, rackId } }),
    prisma.purchaseInvoiceLine.count({ where: { companyId: context.companyId, rackId } }),
    prisma.salesInvoiceLine.count({ where: { companyId: context.companyId, rackId } }),
  ]);

  if ([shelves, balances, movements, purchaseLines, salesLines].some((count) => count > 0)) {
    throw new ApiError(400, "MASTER_IN_USE", "Warehouse rack has shelves, stock, or transaction history and cannot be deactivated.");
  }

  const updated = await prisma.warehouseRack.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "WarehouseRack", updated.id, existing, updated);
  return updated;
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

export async function updateWarehouseShelf(context: MasterContext, shelfId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.warehouseShelf.findFirst({
    where: { id: shelfId, rack: { block: { warehouse: { companyId: context.companyId } } } },
  });

  if (!existing) {
    throw new ApiError(404, "WAREHOUSE_SHELF_NOT_FOUND", "Warehouse shelf not found.");
  }

  const updated = await prisma.warehouseShelf.update({
    where: { id: existing.id },
    data: {
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      barcode: optionalString(data.barcode),
    },
  });
  await auditUpdate(context, "WarehouseShelf", updated.id, existing, updated);
  return updated;
}

export async function deactivateWarehouseShelf(context: MasterContext, shelfId: string) {
  const existing = await prisma.warehouseShelf.findFirst({
    where: { id: shelfId, rack: { block: { warehouse: { companyId: context.companyId } } } },
  });

  if (!existing) {
    throw new ApiError(404, "WAREHOUSE_SHELF_NOT_FOUND", "Warehouse shelf not found.");
  }

  const [balances, movements, purchaseLines, salesLines] = await Promise.all([
    prisma.stockBalance.count({ where: { companyId: context.companyId, shelfId } }),
    prisma.stockMovement.count({ where: { companyId: context.companyId, shelfId } }),
    prisma.purchaseInvoiceLine.count({ where: { companyId: context.companyId, shelfId } }),
    prisma.salesInvoiceLine.count({ where: { companyId: context.companyId, shelfId } }),
  ]);

  if ([balances, movements, purchaseLines, salesLines].some((count) => count > 0)) {
    throw new ApiError(400, "MASTER_IN_USE", "Warehouse shelf has stock or transaction history and cannot be deactivated.");
  }

  const updated = await prisma.warehouseShelf.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "WarehouseShelf", updated.id, existing, updated);
  return updated;
}
