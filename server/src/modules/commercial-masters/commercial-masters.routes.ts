import { Router } from "express";
import type { Request } from "express";
import { requireAuth, requireModuleAccess } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { toCsv } from "../../utils/csv";
import { parsePageQuery } from "../../utils/pagination";
import {
  createCustomer,
  createEmployee,
  createPaymentMode,
  createSupplier,
  createVehicle,
  deactivateCustomer,
  deactivateEmployee,
  deactivatePaymentMode,
  deactivateSupplier,
  deactivateVehicle,
  getCommercialMasterSummary,
  importCustomers,
  importSuppliers,
  listCustomers,
  listCustomersPage,
  listEmployees,
  listPaymentModes,
  listSuppliers,
  listSuppliersPage,
  listVehicles,
  updateCustomer,
  updateEmployee,
  updatePaymentMode,
  updateSupplier,
  updateVehicle,
} from "./commercial-masters.service";

const router = Router();

router.use(requireAuth, requireModuleAccess("masters"));

function context(req: Request) {
  return {
    companyId: req.user!.companyId,
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}

router.get("/commercial-masters/summary", asyncHandler(async (req, res) => {
  sendSuccess(res, await getCommercialMasterSummary(req.user!.companyId));
}));

router.get("/commercial-masters/customers", asyncHandler(async (req, res) => {
  sendSuccess(res, await listCustomers(req.user!.companyId));
}));
router.get("/commercial-masters/customers/page", asyncHandler(async (req, res) => {
  sendSuccess(res, await listCustomersPage(req.user!.companyId, parsePageQuery(req.query)));
}));
router.get("/commercial-masters/customers/export.csv", asyncHandler(async (req, res) => {
  const page = await listCustomersPage(req.user!.companyId, { ...parsePageQuery(req.query), page: 1, pageSize: 1000, skip: 0, take: 1000 });
  const csv = toCsv(
    ["Code", "Name", "Type", "Phone", "Email", "GSTIN", "Address 1", "Address 2", "City", "State", "Pincode", "Place of Supply", "Credit Limit", "Credit Days", "Status"],
    page.items.map((customer) => [
      customer.code,
      customer.name,
      customer.customerType,
      customer.phone ?? "",
      customer.email ?? "",
      customer.gstin ?? "",
      customer.addressLine1 ?? "",
      customer.addressLine2 ?? "",
      customer.city ?? "",
      customer.state ?? "",
      customer.pincode ?? "",
      customer.placeOfSupply ?? "",
      customer.creditLimit,
      customer.creditDays,
      customer.status,
    ]),
  );
  res.header("content-type", "text/csv; charset=utf-8").attachment("rams-customers.csv").send(csv);
}));
router.get("/commercial-masters/customers/import-template.csv", asyncHandler(async (_req, res) => {
  res
    .header("content-type", "text/csv; charset=utf-8")
    .attachment("rams-customers-import-template.csv")
    .send(toCsv(["code", "name", "customerType", "phone", "email", "gstin", "pan", "addressLine1", "addressLine2", "city", "state", "pincode", "placeOfSupply", "creditLimit", "creditDays"], []));
}));
router.post("/commercial-masters/customers", asyncHandler(async (req, res) => {
  sendSuccess(res, await createCustomer(context(req), req.body), "Customer created.", 201);
}));
router.post("/commercial-masters/customers/import", asyncHandler(async (req, res) => {
  sendSuccess(res, await importCustomers(context(req), req.body), "Customers imported.", 201);
}));
router.patch("/commercial-masters/customers/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await updateCustomer(context(req), String(req.params.id), req.body), "Customer updated.");
}));
router.delete("/commercial-masters/customers/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await deactivateCustomer(context(req), String(req.params.id)), "Customer deactivated.");
}));

router.get("/commercial-masters/suppliers", asyncHandler(async (req, res) => {
  sendSuccess(res, await listSuppliers(req.user!.companyId));
}));
router.get("/commercial-masters/suppliers/page", asyncHandler(async (req, res) => {
  sendSuccess(res, await listSuppliersPage(req.user!.companyId, parsePageQuery(req.query)));
}));
router.get("/commercial-masters/suppliers/export.csv", asyncHandler(async (req, res) => {
  const page = await listSuppliersPage(req.user!.companyId, { ...parsePageQuery(req.query), page: 1, pageSize: 1000, skip: 0, take: 1000 });
  const csv = toCsv(
    ["Code", "Name", "Type", "Phone", "Email", "GSTIN", "Credit Days", "Status"],
    page.items.map((supplier) => [
      supplier.code,
      supplier.name,
      supplier.supplierType,
      supplier.phone ?? "",
      supplier.email ?? "",
      supplier.gstin ?? "",
      supplier.creditDays,
      supplier.status,
    ]),
  );
  res.header("content-type", "text/csv; charset=utf-8").attachment("rams-suppliers.csv").send(csv);
}));
router.get("/commercial-masters/suppliers/import-template.csv", asyncHandler(async (_req, res) => {
  res
    .header("content-type", "text/csv; charset=utf-8")
    .attachment("rams-suppliers-import-template.csv")
    .send(toCsv(["code", "name", "supplierType", "phone", "email", "gstin", "pan", "creditDays"], []));
}));
router.post("/commercial-masters/suppliers", asyncHandler(async (req, res) => {
  sendSuccess(res, await createSupplier(context(req), req.body), "Supplier created.", 201);
}));
router.post("/commercial-masters/suppliers/import", asyncHandler(async (req, res) => {
  sendSuccess(res, await importSuppliers(context(req), req.body), "Suppliers imported.", 201);
}));
router.patch("/commercial-masters/suppliers/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await updateSupplier(context(req), String(req.params.id), req.body), "Supplier updated.");
}));
router.delete("/commercial-masters/suppliers/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await deactivateSupplier(context(req), String(req.params.id)), "Supplier deactivated.");
}));

router.get("/commercial-masters/employees", asyncHandler(async (req, res) => {
  sendSuccess(res, await listEmployees(req.user!.companyId));
}));
router.post("/commercial-masters/employees", asyncHandler(async (req, res) => {
  sendSuccess(res, await createEmployee(context(req), req.body), "Employee created.", 201);
}));
router.patch("/commercial-masters/employees/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await updateEmployee(context(req), String(req.params.id), req.body), "Employee updated.");
}));
router.delete("/commercial-masters/employees/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await deactivateEmployee(context(req), String(req.params.id)), "Employee deactivated.");
}));

router.get("/commercial-masters/vehicles", asyncHandler(async (req, res) => {
  sendSuccess(res, await listVehicles(req.user!.companyId));
}));
router.post("/commercial-masters/vehicles", asyncHandler(async (req, res) => {
  sendSuccess(res, await createVehicle(context(req), req.body), "Vehicle created.", 201);
}));
router.patch("/commercial-masters/vehicles/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await updateVehicle(context(req), String(req.params.id), req.body), "Vehicle updated.");
}));
router.delete("/commercial-masters/vehicles/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await deactivateVehicle(context(req), String(req.params.id)), "Vehicle deactivated.");
}));

router.get("/commercial-masters/payment-modes", asyncHandler(async (req, res) => {
  sendSuccess(res, await listPaymentModes(req.user!.companyId));
}));
router.post("/commercial-masters/payment-modes", asyncHandler(async (req, res) => {
  sendSuccess(res, await createPaymentMode(context(req), req.body), "Payment mode created.", 201);
}));
router.patch("/commercial-masters/payment-modes/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await updatePaymentMode(context(req), String(req.params.id), req.body), "Payment mode updated.");
}));
router.delete("/commercial-masters/payment-modes/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await deactivatePaymentMode(context(req), String(req.params.id)), "Payment mode deactivated.");
}));

export default router;
