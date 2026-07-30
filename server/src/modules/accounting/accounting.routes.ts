import { Router } from "express";
import type { Request } from "express";
import { requireAuth, requireModuleAccess, requirePermission } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import {
  createAccount,
  getAccountingSummary,
  getBalanceSheet,
  getGstRegisters,
  getGstSummary,
  getPartyOutstanding,
  getPartyLedgerSummary,
  getProfitAndLoss,
  getTrialBalance,
  listAccounts,
  listGeneralLedger,
  listJournalEntries,
  listPartyLedgerEntries,
  postContraVoucher,
  postJournalEntry,
  parseReportDateRange,
  seedDefaultAccounts,
} from "./accounting.service";

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

router.get("/accounting/summary", asyncHandler(async (req, res) => {
  sendSuccess(res, await getAccountingSummary(req.user!.companyId));
}));

router.get("/accounting/accounts", asyncHandler(async (req, res) => {
  sendSuccess(res, await listAccounts(req.user!.companyId));
}));

router.post("/accounting/accounts", asyncHandler(async (req, res) => {
  sendSuccess(res, await createAccount(context(req), req.body), "Account created.", 201);
}));

router.post("/accounting/accounts/seed-defaults", asyncHandler(async (req, res) => {
  sendSuccess(res, await seedDefaultAccounts(context(req)), "Default accounts seeded.");
}));

router.get("/accounting/journal-entries", asyncHandler(async (req, res) => {
  sendSuccess(res, await listJournalEntries(req.user!.companyId));
}));

router.get("/accounting/trial-balance", asyncHandler(async (req, res) => {
  sendSuccess(res, await getTrialBalance(req.user!.companyId));
}));

router.get("/accounting/general-ledger", asyncHandler(async (req, res) => {
  sendSuccess(res, await listGeneralLedger(req.user!.companyId, String(req.query.accountId ?? "")));
}));

router.get("/accounting/profit-and-loss", asyncHandler(async (req, res) => {
  sendSuccess(res, await getProfitAndLoss(req.user!.companyId));
}));

router.get("/accounting/balance-sheet", asyncHandler(async (req, res) => {
  sendSuccess(res, await getBalanceSheet(req.user!.companyId));
}));

router.get("/accounting/party-ledger-summary", asyncHandler(async (req, res) => {
  sendSuccess(res, await getPartyLedgerSummary(req.user!.companyId));
}));

router.get("/accounting/party-ledger", asyncHandler(async (req, res) => {
  sendSuccess(res, await listPartyLedgerEntries(req.user!.companyId, String(req.query.partyType ?? "")));
}));

router.get("/accounting/gst-summary", asyncHandler(async (req, res) => {
  const { from, to } = parseReportDateRange(req.query);
  sendSuccess(res, await getGstSummary(req.user!.companyId, from, to));
}));

router.get("/accounting/gst-registers", asyncHandler(async (req, res) => {
  const { from, to } = parseReportDateRange(req.query);
  sendSuccess(res, await getGstRegisters(req.user!.companyId, from, to));
}));

router.get("/accounting/party-outstanding", asyncHandler(async (req, res) => {
  sendSuccess(res, await getPartyOutstanding(req.user!.companyId));
}));

router.post("/accounting/journal-entries", requirePermission("accounting", "post"), asyncHandler(async (req, res) => {
  sendSuccess(res, await postJournalEntry(context(req), req.body), "Journal entry posted.", 201);
}));

router.post("/accounting/contra-vouchers", requirePermission("accounting", "post"), asyncHandler(async (req, res) => {
  sendSuccess(res, await postContraVoucher(context(req), req.body), "Contra voucher posted.", 201);
}));

export default router;
