import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { createNumberSeries, listNumberSeries } from "./number-series.service";

const router = Router();

router.use(requireAuth);

router.get(
  "/number-series",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await listNumberSeries(req.user!.companyId));
  }),
);

router.post(
  "/number-series",
  asyncHandler(async (req, res) => {
    const numberSeries = await createNumberSeries(req.user!.companyId, req.body, {
      companyId: req.user!.companyId,
      userId: req.user!.id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    sendSuccess(res, numberSeries, "Number series created.", 201);
  }),
);

export default router;
