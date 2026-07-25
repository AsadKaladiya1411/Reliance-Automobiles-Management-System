import { Router } from "express";
import { requireAuth, requireModuleAccess } from "../auth/auth.middleware";
import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import {
  createBrand,
  createCategory,
  createHsnCode,
  createProduct,
  createProductVariant,
  createSubCategory,
  createTaxRate,
  createUnit,
  createWarehouse,
  createWarehouseBlock,
  createWarehouseRack,
  createWarehouseShelf,
  deactivateBrand,
  deactivateCategory,
  deactivateHsnCode,
  deactivateProduct,
  deactivateProductVariant,
  deactivateTaxRate,
  deactivateUnit,
  deactivateWarehouse,
  deactivateWarehouseBlock,
  deactivateWarehouseRack,
  deactivateWarehouseShelf,
  getMasterSummary,
  listBrands,
  listCategories,
  listHsnCodes,
  listProducts,
  listProductVariants,
  listSubCategories,
  listTaxRates,
  listUnits,
  listWarehouses,
  updateBrand,
  updateCategory,
  updateHsnCode,
  updateProduct,
  updateProductVariant,
  updateTaxRate,
  updateUnit,
  updateWarehouse,
  updateWarehouseBlock,
  updateWarehouseRack,
  updateWarehouseShelf,
} from "./masters.service";

const router = Router();

router.use(requireAuth, requireModuleAccess("masters"));

function context(req: Parameters<Parameters<typeof asyncHandler>[0]>[0]) {
  return {
    companyId: req.user!.companyId,
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}

function routeParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "MISSING_ROUTE_PARAMETER", `Missing route parameter: ${name}.`);
  }

  return value;
}

router.get("/masters/summary", asyncHandler(async (req, res) => {
  sendSuccess(res, await getMasterSummary(req.user!.companyId));
}));

router.get("/masters/units", asyncHandler(async (req, res) => {
  sendSuccess(res, await listUnits(req.user!.companyId));
}));
router.post("/masters/units", asyncHandler(async (req, res) => {
  sendSuccess(res, await createUnit(context(req), req.body), "Unit created.", 201);
}));
router.patch("/masters/units/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await updateUnit(context(req), routeParam(req.params.id, "id"), req.body), "Unit updated.");
}));
router.delete("/masters/units/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await deactivateUnit(context(req), routeParam(req.params.id, "id")), "Unit deactivated.");
}));

router.get("/masters/hsn-codes", asyncHandler(async (req, res) => {
  sendSuccess(res, await listHsnCodes(req.user!.companyId));
}));
router.post("/masters/hsn-codes", asyncHandler(async (req, res) => {
  sendSuccess(res, await createHsnCode(context(req), req.body), "HSN code created.", 201);
}));
router.patch("/masters/hsn-codes/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await updateHsnCode(context(req), routeParam(req.params.id, "id"), req.body), "HSN code updated.");
}));
router.delete("/masters/hsn-codes/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await deactivateHsnCode(context(req), routeParam(req.params.id, "id")), "HSN code deactivated.");
}));

router.get("/masters/tax-rates", asyncHandler(async (req, res) => {
  sendSuccess(res, await listTaxRates(req.user!.companyId));
}));
router.post("/masters/tax-rates", asyncHandler(async (req, res) => {
  sendSuccess(res, await createTaxRate(context(req), req.body), "Tax rate created.", 201);
}));
router.patch("/masters/tax-rates/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await updateTaxRate(context(req), routeParam(req.params.id, "id"), req.body), "Tax rate updated.");
}));
router.delete("/masters/tax-rates/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await deactivateTaxRate(context(req), routeParam(req.params.id, "id")), "Tax rate deactivated.");
}));

router.get("/masters/brands", asyncHandler(async (req, res) => {
  sendSuccess(res, await listBrands(req.user!.companyId));
}));
router.post("/masters/brands", asyncHandler(async (req, res) => {
  sendSuccess(res, await createBrand(context(req), req.body), "Brand created.", 201);
}));
router.patch("/masters/brands/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await updateBrand(context(req), routeParam(req.params.id, "id"), req.body), "Brand updated.");
}));
router.delete("/masters/brands/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await deactivateBrand(context(req), routeParam(req.params.id, "id")), "Brand deactivated.");
}));

router.get("/masters/categories", asyncHandler(async (req, res) => {
  sendSuccess(res, await listCategories(req.user!.companyId));
}));
router.post("/masters/categories", asyncHandler(async (req, res) => {
  sendSuccess(res, await createCategory(context(req), req.body), "Category created.", 201);
}));
router.patch("/masters/categories/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await updateCategory(context(req), routeParam(req.params.id, "id"), req.body), "Category updated.");
}));
router.delete("/masters/categories/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await deactivateCategory(context(req), routeParam(req.params.id, "id")), "Category deactivated.");
}));

router.get("/masters/sub-categories", asyncHandler(async (req, res) => {
  sendSuccess(res, await listSubCategories(req.user!.companyId));
}));
router.post("/masters/sub-categories", asyncHandler(async (req, res) => {
  sendSuccess(res, await createSubCategory(context(req), req.body), "Sub-category created.", 201);
}));

router.get("/masters/products", asyncHandler(async (req, res) => {
  sendSuccess(res, await listProducts(req.user!.companyId));
}));
router.post("/masters/products", asyncHandler(async (req, res) => {
  sendSuccess(res, await createProduct(context(req), req.body), "Product created.", 201);
}));
router.patch("/masters/products/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await updateProduct(context(req), routeParam(req.params.id, "id"), req.body), "Product updated.");
}));
router.delete("/masters/products/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await deactivateProduct(context(req), routeParam(req.params.id, "id")), "Product deactivated.");
}));

router.get("/masters/product-variants", asyncHandler(async (req, res) => {
  sendSuccess(res, await listProductVariants(req.user!.companyId));
}));
router.post("/masters/product-variants", asyncHandler(async (req, res) => {
  sendSuccess(res, await createProductVariant(context(req), req.body), "Product variant created.", 201);
}));
router.patch("/masters/product-variants/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await updateProductVariant(context(req), routeParam(req.params.id, "id"), req.body), "Product variant updated.");
}));
router.delete("/masters/product-variants/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await deactivateProductVariant(context(req), routeParam(req.params.id, "id")), "Product variant deactivated.");
}));

router.get("/masters/warehouses", asyncHandler(async (req, res) => {
  sendSuccess(res, await listWarehouses(req.user!.companyId));
}));
router.post("/masters/warehouses", asyncHandler(async (req, res) => {
  sendSuccess(res, await createWarehouse(context(req), req.body), "Warehouse created.", 201);
}));
router.patch("/masters/warehouses/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await updateWarehouse(context(req), routeParam(req.params.id, "id"), req.body), "Warehouse updated.");
}));
router.delete("/masters/warehouses/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await deactivateWarehouse(context(req), routeParam(req.params.id, "id")), "Warehouse deactivated.");
}));
router.post("/masters/warehouses/:warehouseId/blocks", asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await createWarehouseBlock(context(req), routeParam(req.params.warehouseId, "warehouseId"), req.body),
    "Warehouse block created.",
    201,
  );
}));
router.patch("/masters/warehouse-blocks/:blockId", asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await updateWarehouseBlock(context(req), routeParam(req.params.blockId, "blockId"), req.body),
    "Warehouse block updated.",
  );
}));
router.delete("/masters/warehouse-blocks/:blockId", asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await deactivateWarehouseBlock(context(req), routeParam(req.params.blockId, "blockId")),
    "Warehouse block deactivated.",
  );
}));
router.post("/masters/warehouse-blocks/:blockId/racks", asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await createWarehouseRack(context(req), routeParam(req.params.blockId, "blockId"), req.body),
    "Warehouse rack created.",
    201,
  );
}));
router.patch("/masters/warehouse-racks/:rackId", asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await updateWarehouseRack(context(req), routeParam(req.params.rackId, "rackId"), req.body),
    "Warehouse rack updated.",
  );
}));
router.delete("/masters/warehouse-racks/:rackId", asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await deactivateWarehouseRack(context(req), routeParam(req.params.rackId, "rackId")),
    "Warehouse rack deactivated.",
  );
}));
router.post("/masters/warehouse-racks/:rackId/shelves", asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await createWarehouseShelf(context(req), routeParam(req.params.rackId, "rackId"), req.body),
    "Warehouse shelf created.",
    201,
  );
}));
router.patch("/masters/warehouse-shelves/:shelfId", asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await updateWarehouseShelf(context(req), routeParam(req.params.shelfId, "shelfId"), req.body),
    "Warehouse shelf updated.",
  );
}));
router.delete("/masters/warehouse-shelves/:shelfId", asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await deactivateWarehouseShelf(context(req), routeParam(req.params.shelfId, "shelfId")),
    "Warehouse shelf deactivated.",
  );
}));

export default router;
