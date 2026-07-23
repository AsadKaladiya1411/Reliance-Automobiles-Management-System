import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import {
  createCustomer,
  createEmployee,
  createPaymentMode,
  createSupplier,
  createVehicle,
  getCommercialMasterSummary,
  listCustomers,
  listEmployees,
  listPaymentModes,
  listSuppliers,
  listVehicles,
} from "./commercial-masters.service";

const router = Router();

router.use(requireAuth);

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
router.post("/commercial-masters/customers", asyncHandler(async (req, res) => {
  sendSuccess(res, await createCustomer(context(req), req.body), "Customer created.", 201);
}));

router.get("/commercial-masters/suppliers", asyncHandler(async (req, res) => {
  sendSuccess(res, await listSuppliers(req.user!.companyId));
}));
router.post("/commercial-masters/suppliers", asyncHandler(async (req, res) => {
  sendSuccess(res, await createSupplier(context(req), req.body), "Supplier created.", 201);
}));

router.get("/commercial-masters/employees", asyncHandler(async (req, res) => {
  sendSuccess(res, await listEmployees(req.user!.companyId));
}));
router.post("/commercial-masters/employees", asyncHandler(async (req, res) => {
  sendSuccess(res, await createEmployee(context(req), req.body), "Employee created.", 201);
}));

router.get("/commercial-masters/vehicles", asyncHandler(async (req, res) => {
  sendSuccess(res, await listVehicles(req.user!.companyId));
}));
router.post("/commercial-masters/vehicles", asyncHandler(async (req, res) => {
  sendSuccess(res, await createVehicle(context(req), req.body), "Vehicle created.", 201);
}));

router.get("/commercial-masters/payment-modes", asyncHandler(async (req, res) => {
  sendSuccess(res, await listPaymentModes(req.user!.companyId));
}));
router.post("/commercial-masters/payment-modes", asyncHandler(async (req, res) => {
  sendSuccess(res, await createPaymentMode(context(req), req.body), "Payment mode created.", 201);
}));

export default router;
