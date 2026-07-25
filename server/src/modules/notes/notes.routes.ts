import { Router } from "express";
import type { Request } from "express";
import { requireAuth, requireModuleAccess } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { listFinancialNotes, postFinancialNote } from "./notes.service";

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

router.get("/notes", asyncHandler(async (req, res) => {
  sendSuccess(res, await listFinancialNotes(req.user!.companyId));
}));

router.post("/notes", asyncHandler(async (req, res) => {
  sendSuccess(res, await postFinancialNote(context(req), req.body), "Financial note posted.", 201);
}));

export default router;
