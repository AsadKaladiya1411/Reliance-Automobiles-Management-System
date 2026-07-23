import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
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
} from "./masters.service";

const router = Router();

router.use(requireAuth);

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
    throw new Error(`Missing route parameter: ${name}`);
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

router.get("/masters/hsn-codes", asyncHandler(async (req, res) => {
  sendSuccess(res, await listHsnCodes(req.user!.companyId));
}));
router.post("/masters/hsn-codes", asyncHandler(async (req, res) => {
  sendSuccess(res, await createHsnCode(context(req), req.body), "HSN code created.", 201);
}));

router.get("/masters/tax-rates", asyncHandler(async (req, res) => {
  sendSuccess(res, await listTaxRates(req.user!.companyId));
}));
router.post("/masters/tax-rates", asyncHandler(async (req, res) => {
  sendSuccess(res, await createTaxRate(context(req), req.body), "Tax rate created.", 201);
}));

router.get("/masters/brands", asyncHandler(async (req, res) => {
  sendSuccess(res, await listBrands(req.user!.companyId));
}));
router.post("/masters/brands", asyncHandler(async (req, res) => {
  sendSuccess(res, await createBrand(context(req), req.body), "Brand created.", 201);
}));

router.get("/masters/categories", asyncHandler(async (req, res) => {
  sendSuccess(res, await listCategories(req.user!.companyId));
}));
router.post("/masters/categories", asyncHandler(async (req, res) => {
  sendSuccess(res, await createCategory(context(req), req.body), "Category created.", 201);
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

router.get("/masters/product-variants", asyncHandler(async (req, res) => {
  sendSuccess(res, await listProductVariants(req.user!.companyId));
}));
router.post("/masters/product-variants", asyncHandler(async (req, res) => {
  sendSuccess(res, await createProductVariant(context(req), req.body), "Product variant created.", 201);
}));

router.get("/masters/warehouses", asyncHandler(async (req, res) => {
  sendSuccess(res, await listWarehouses(req.user!.companyId));
}));
router.post("/masters/warehouses", asyncHandler(async (req, res) => {
  sendSuccess(res, await createWarehouse(context(req), req.body), "Warehouse created.", 201);
}));
router.post("/masters/warehouses/:warehouseId/blocks", asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await createWarehouseBlock(context(req), routeParam(req.params.warehouseId, "warehouseId"), req.body),
    "Warehouse block created.",
    201,
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
router.post("/masters/warehouse-racks/:rackId/shelves", asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await createWarehouseShelf(context(req), routeParam(req.params.rackId, "rackId"), req.body),
    "Warehouse shelf created.",
    201,
  );
}));

export default router;
