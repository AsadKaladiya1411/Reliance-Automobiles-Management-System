import { Router } from "express";
import { requireAuth, requireModuleAccess } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { listAuditLogs } from "./audit.service";

const router = Router();

router.use(requireAuth, requireModuleAccess("audit"));

router.get("/audit/logs", asyncHandler(async (req, res) => {
  sendSuccess(res, await listAuditLogs(req.user!.companyId));
}));

export default router;
