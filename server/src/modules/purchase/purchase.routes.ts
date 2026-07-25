import { Router } from "express";
import type { Request } from "express";
import { requireAuth, requireModuleAccess } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import {
  cancelPurchaseInvoice,
  createGoodsReceiptNote,
  createPurchaseOrder,
  getPurchaseSummary,
  listGoodsReceiptNotes,
  listPurchaseInvoices,
  listPurchaseOrders,
  listPurchaseReturns,
  postPurchaseInvoice,
  postPurchaseReturn,
} from "./purchase.service";

const router = Router();

router.use(requireAuth, requireModuleAccess("purchase"));

function context(req: Request) {
  return {
    companyId: req.user!.companyId,
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}

router.get("/purchase/summary", asyncHandler(async (req, res) => {
  sendSuccess(res, await getPurchaseSummary(req.user!.companyId));
}));

router.get("/purchase/invoices", asyncHandler(async (req, res) => {
  sendSuccess(res, await listPurchaseInvoices(req.user!.companyId));
}));

router.get("/purchase/orders", asyncHandler(async (req, res) => {
  sendSuccess(res, await listPurchaseOrders(req.user!.companyId));
}));

router.get("/purchase/grns", asyncHandler(async (req, res) => {
  sendSuccess(res, await listGoodsReceiptNotes(req.user!.companyId));
}));

router.get("/purchase/returns", asyncHandler(async (req, res) => {
  sendSuccess(res, await listPurchaseReturns(req.user!.companyId));
}));

router.post("/purchase/invoices", asyncHandler(async (req, res) => {
  sendSuccess(res, await postPurchaseInvoice(context(req), req.body), "Purchase invoice posted.", 201);
}));

router.post("/purchase/orders", asyncHandler(async (req, res) => {
  sendSuccess(res, await createPurchaseOrder(context(req), req.body), "Purchase order created.", 201);
}));

router.post("/purchase/grns", asyncHandler(async (req, res) => {
  sendSuccess(res, await createGoodsReceiptNote(context(req), req.body), "GRN created.", 201);
}));

router.post("/purchase/invoices/:id/cancel", asyncHandler(async (req, res) => {
  sendSuccess(res, await cancelPurchaseInvoice(context(req), String(req.params.id), req.body), "Purchase invoice cancelled.");
}));

router.post("/purchase/returns", asyncHandler(async (req, res) => {
  sendSuccess(res, await postPurchaseReturn(context(req), req.body), "Purchase return posted.", 201);
}));

export default router;
