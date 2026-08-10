import { Router } from "express";
import { requireAuth, requireModuleAccess } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { getCompany, getInvoiceCompanyProfile, updateCompany } from "./company.service";

const router = Router();

router.get(
  "/company/invoice-profile",
  requireAuth,
  requireModuleAccess("sales"),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await getInvoiceCompanyProfile(req.user!.companyId));
  }),
);

router.use(requireAuth, requireModuleAccess("company"));

router.get(
  "/company",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await getCompany(req.user!.companyId));
  }),
);

router.patch(
  "/company",
  asyncHandler(async (req, res) => {
    const company = await updateCompany(req.user!.companyId, req.body, {
      companyId: req.user!.companyId,
      userId: req.user!.id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    sendSuccess(res, company, "Company profile updated.");
  }),
);

export default router;
