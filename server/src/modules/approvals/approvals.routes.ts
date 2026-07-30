import { Router } from "express";
import type { Request } from "express";
import { requireAuth, requireModuleAccess, requirePermission } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import {
  decideApprovalRequest,
  listApprovalRequests,
  listApprovalRules,
  saveApprovalRule,
  submitApprovalRequest,
} from "./approvals.service";

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

router.get("/approvals/rules", requireModuleAccess("settings"), asyncHandler(async (req, res) => {
  sendSuccess(res, await listApprovalRules(req.user!.companyId));
}));

router.post("/approvals/rules", requireModuleAccess("settings"), requirePermission("settings", "update"), asyncHandler(async (req, res) => {
  sendSuccess(res, await saveApprovalRule(context(req), req.body), "Approval rule saved.");
}));

router.get("/approvals/requests", requireModuleAccess("settings"), asyncHandler(async (req, res) => {
  sendSuccess(res, await listApprovalRequests(req.user!.companyId));
}));

router.post("/approvals/requests", requireModuleAccess("settings"), requirePermission("settings", "create"), asyncHandler(async (req, res) => {
  sendSuccess(res, await submitApprovalRequest(context(req), req.body), "Approval request submitted.", 201);
}));

router.post("/approvals/requests/:id/decision", requireModuleAccess("settings"), requirePermission("settings", "approve"), asyncHandler(async (req, res) => {
  sendSuccess(res, await decideApprovalRequest(context(req), String(req.params.id), req.body), "Approval request decided.");
}));

export default router;
