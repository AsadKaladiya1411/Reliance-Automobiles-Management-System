import { Router } from "express";
import type { Request } from "express";
import { requireAuth, requireModuleAccess, requirePermission } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { getInvoiceCompanyProfile } from "../company/company.service";
import {
  createJobCard,
  getWorkshopSummary,
  issueJobCardParts,
  listServiceHistory,
  listJobCards,
  postJobCardBilling,
  updateJobCardInspection,
  updateJobCardTechnician,
  updateJobCardStatus,
} from "./workshop.service";

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

router.get("/workshop/document-profile", asyncHandler(async (req, res) => {
  sendSuccess(res, await getInvoiceCompanyProfile(req.user!.companyId));
}));

router.get("/workshop/job-cards", asyncHandler(async (req, res) => {
  sendSuccess(res, await listJobCards(req.user!.companyId));
}));

router.get("/workshop/service-history", asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await listServiceHistory(
      req.user!.companyId,
      typeof req.query.vehicleId === "string" ? req.query.vehicleId : undefined,
      typeof req.query.customerId === "string" ? req.query.customerId : undefined,
    ),
  );
}));

router.post("/workshop/job-cards", asyncHandler(async (req, res) => {
  sendSuccess(res, await createJobCard(context(req), req.body), "Job card created.", 201);
}));

router.patch("/workshop/job-cards/:id/status", requirePermission("workshop", "update"), asyncHandler(async (req, res) => {
  sendSuccess(res, await updateJobCardStatus(context(req), String(req.params.id), req.body), "Job card status updated.");
}));

router.patch("/workshop/job-cards/:id/inspection", requirePermission("workshop", "update"), asyncHandler(async (req, res) => {
  sendSuccess(res, await updateJobCardInspection(context(req), String(req.params.id), req.body), "Job card inspection updated.");
}));

router.patch("/workshop/job-cards/:id/technician", requirePermission("workshop", "update"), asyncHandler(async (req, res) => {
  sendSuccess(res, await updateJobCardTechnician(context(req), String(req.params.id), req.body), "Job card technician progress updated.");
}));

router.post("/workshop/job-cards/:id/issue-parts", requirePermission("workshop", "post"), asyncHandler(async (req, res) => {
  sendSuccess(res, await issueJobCardParts(context(req), String(req.params.id), req.body), "Workshop parts issued.");
}));

router.post("/workshop/job-cards/:id/bill", requirePermission("workshop", "post"), asyncHandler(async (req, res) => {
  sendSuccess(res, await postJobCardBilling(context(req), String(req.params.id), req.body), "Workshop job card billed.");
}));

export default router;
