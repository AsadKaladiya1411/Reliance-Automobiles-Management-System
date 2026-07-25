import { Router } from "express";
import type { Request } from "express";
import { requireAuth, requireModuleAccess } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import {
  cancelSalesInvoice,
  createDeliveryChallan,
  createSalesOrder,
  createSalesQuotation,
  getSalesSummary,
  listDeliveryChallans,
  listSalesInvoices,
  listSalesOrders,
  listSalesQuotations,
  listSalesReturns,
  postSalesInvoice,
  postSalesReturn,
} from "./sales.service";

const router = Router();

router.use(requireAuth, requireModuleAccess("sales"));

function context(req: Request) {
  return {
    companyId: req.user!.companyId,
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}

router.get("/sales/summary", asyncHandler(async (req, res) => {
  sendSuccess(res, await getSalesSummary(req.user!.companyId));
}));

router.get("/sales/invoices", asyncHandler(async (req, res) => {
  sendSuccess(res, await listSalesInvoices(req.user!.companyId));
}));

router.get("/sales/quotations", asyncHandler(async (req, res) => {
  sendSuccess(res, await listSalesQuotations(req.user!.companyId));
}));

router.get("/sales/orders", asyncHandler(async (req, res) => {
  sendSuccess(res, await listSalesOrders(req.user!.companyId));
}));

router.get("/sales/delivery-challans", asyncHandler(async (req, res) => {
  sendSuccess(res, await listDeliveryChallans(req.user!.companyId));
}));

router.get("/sales/returns", asyncHandler(async (req, res) => {
  sendSuccess(res, await listSalesReturns(req.user!.companyId));
}));

router.post("/sales/invoices", asyncHandler(async (req, res) => {
  sendSuccess(res, await postSalesInvoice(context(req), req.body), "Sales invoice posted.", 201);
}));

router.post("/sales/quotations", asyncHandler(async (req, res) => {
  sendSuccess(res, await createSalesQuotation(context(req), req.body), "Sales quotation created.", 201);
}));

router.post("/sales/orders", asyncHandler(async (req, res) => {
  sendSuccess(res, await createSalesOrder(context(req), req.body), "Sales order created.", 201);
}));

router.post("/sales/delivery-challans", asyncHandler(async (req, res) => {
  sendSuccess(res, await createDeliveryChallan(context(req), req.body), "Delivery challan created.", 201);
}));

router.post("/sales/invoices/:id/cancel", asyncHandler(async (req, res) => {
  sendSuccess(res, await cancelSalesInvoice(context(req), String(req.params.id), req.body), "Sales invoice cancelled.");
}));

router.post("/sales/returns", asyncHandler(async (req, res) => {
  sendSuccess(res, await postSalesReturn(context(req), req.body), "Sales return posted.", 201);
}));

export default router;
