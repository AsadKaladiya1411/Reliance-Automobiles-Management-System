import { Router } from "express";
import type { Request } from "express";
import { requireAuth, requireModuleAccess, requirePermission } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { getPaymentSummary, listPayments, postPayment } from "./payments.service";

const router = Router();

router.use(requireAuth, requireModuleAccess("accounting"));

function context(req: Request) {
  return {
    companyId: req.user!.companyId,
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}

router.get("/payments/summary", asyncHandler(async (req, res) => {
  sendSuccess(res, await getPaymentSummary(req.user!.companyId));
}));

router.get("/payments", asyncHandler(async (req, res) => {
  sendSuccess(res, await listPayments(req.user!.companyId));
}));

router.post("/payments", requirePermission("accounting", "post"), asyncHandler(async (req, res) => {
  sendSuccess(res, await postPayment(context(req), req.body), "Payment posted.", 201);
}));

export default router;
