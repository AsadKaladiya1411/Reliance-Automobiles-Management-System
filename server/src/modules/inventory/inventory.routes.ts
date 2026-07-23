import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import {
  getInventorySummary,
  listStockBalances,
  listStockMovements,
  postOpeningStock,
  postStockAdjustment,
  postStockTransfer,
} from "./inventory.service";

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

router.get(
  "/inventory/summary",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await getInventorySummary(req.user!.companyId));
  }),
);

router.get(
  "/inventory/stock-balances",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await listStockBalances(req.user!.companyId));
  }),
);

router.get(
  "/inventory/stock-movements",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await listStockMovements(req.user!.companyId));
  }),
);

router.post(
  "/inventory/opening-stock",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await postOpeningStock(context(req), req.body), "Opening stock posted.", 201);
  }),
);

router.post(
  "/inventory/stock-adjustments",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await postStockAdjustment(context(req), req.body), "Stock adjustment posted.", 201);
  }),
);

router.post(
  "/inventory/stock-transfers",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await postStockTransfer(context(req), req.body), "Stock transfer posted.", 201);
  }),
);

export default router;
