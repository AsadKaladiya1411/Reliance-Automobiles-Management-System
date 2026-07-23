import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { cancelSalesInvoice, getSalesSummary, listSalesInvoices, postSalesInvoice } from "./sales.service";

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

router.get("/sales/summary", asyncHandler(async (req, res) => {
  sendSuccess(res, await getSalesSummary(req.user!.companyId));
}));

router.get("/sales/invoices", asyncHandler(async (req, res) => {
  sendSuccess(res, await listSalesInvoices(req.user!.companyId));
}));

router.post("/sales/invoices", asyncHandler(async (req, res) => {
  sendSuccess(res, await postSalesInvoice(context(req), req.body), "Sales invoice posted.", 201);
}));

router.post("/sales/invoices/:id/cancel", asyncHandler(async (req, res) => {
  sendSuccess(res, await cancelSalesInvoice(context(req), String(req.params.id), req.body), "Sales invoice cancelled.");
}));

export default router;
