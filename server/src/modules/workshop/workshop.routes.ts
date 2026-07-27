import { Router } from "express";
import type { Request } from "express";
import { requireAuth, requireModuleAccess, requirePermission } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { createJobCard, getWorkshopSummary, issueJobCardParts, listJobCards, updateJobCardStatus } from "./workshop.service";

const router = Router();

router.use(requireAuth, requireModuleAccess("workshop"));

function context(req: Request) {
  return {
    companyId: req.user!.companyId,
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}

router.get("/workshop/summary", asyncHandler(async (req, res) => {
  sendSuccess(res, await getWorkshopSummary(req.user!.companyId));
}));

router.get("/workshop/job-cards", asyncHandler(async (req, res) => {
  sendSuccess(res, await listJobCards(req.user!.companyId));
}));

router.post("/workshop/job-cards", asyncHandler(async (req, res) => {
  sendSuccess(res, await createJobCard(context(req), req.body), "Job card created.", 201);
}));

router.patch("/workshop/job-cards/:id/status", requirePermission("workshop", "update"), asyncHandler(async (req, res) => {
  sendSuccess(res, await updateJobCardStatus(context(req), String(req.params.id), req.body), "Job card status updated.");
}));

router.post("/workshop/job-cards/:id/issue-parts", requirePermission("workshop", "post"), asyncHandler(async (req, res) => {
  sendSuccess(res, await issueJobCardParts(context(req), String(req.params.id), req.body), "Workshop parts issued.");
}));

export default router;
