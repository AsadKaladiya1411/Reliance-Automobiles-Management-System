import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { createFinancialYear, listFinancialYears } from "./financial-year.service";

const router = Router();

router.use(requireAuth);

router.get(
  "/financial-years",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await listFinancialYears(req.user!.companyId));
  }),
);

router.post(
  "/financial-years",
  asyncHandler(async (req, res) => {
    const financialYear = await createFinancialYear(req.user!.companyId, req.body, {
      companyId: req.user!.companyId,
      userId: req.user!.id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    sendSuccess(res, financialYear, "Financial year created.", 201);
  }),
);

export default router;
