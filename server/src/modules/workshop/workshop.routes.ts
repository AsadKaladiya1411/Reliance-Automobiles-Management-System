import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { createJobCard, getWorkshopSummary, listJobCards, updateJobCardStatus } from "./workshop.service";

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

router.get("/workshop/summary", asyncHandler(async (req, res) => {
  sendSuccess(res, await getWorkshopSummary(req.user!.companyId));
}));

router.get("/workshop/job-cards", asyncHandler(async (req, res) => {
  sendSuccess(res, await listJobCards(req.user!.companyId));
}));

router.post("/workshop/job-cards", asyncHandler(async (req, res) => {
  sendSuccess(res, await createJobCard(context(req), req.body), "Job card created.", 201);
}));

router.patch("/workshop/job-cards/:id/status", asyncHandler(async (req, res) => {
  sendSuccess(res, await updateJobCardStatus(context(req), String(req.params.id), req.body), "Job card status updated.");
}));

export default router;
