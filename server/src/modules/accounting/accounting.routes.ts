import { Router } from "express";
import type { Request } from "express";
import { requireAuth, requireModuleAccess, requirePermission } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { toCsv } from "../../utils/csv";
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

type GstRegisterRow = Awaited<ReturnType<typeof getGstRegisters>>["inputRows"][number];

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

function dateCell(value: Date) {
  return value.toISOString().slice(0, 10);
}

function taxRateCell(row: GstRegisterRow) {
  const taxableAmount = Number(row.taxableAmount);
  const totalTaxAmount = Number(row.totalTaxAmount);
  if (!Number.isFinite(taxableAmount) || taxableAmount === 0 || !Number.isFinite(totalTaxAmount)) {
    return "0";
  }

  return ((Math.abs(totalTaxAmount) / Math.abs(taxableAmount)) * 100).toFixed(2);
}

function gstrInvoiceType(row: GstRegisterRow) {
  return row.documentType.includes("RETURN") ? "Credit/Debit Note" : "Regular";
}

router.get("/accounting/gstr-1.csv", asyncHandler(async (req, res) => {
  const { from, to } = parseReportDateRange(req.query);
  const registers = await getGstRegisters(req.user!.companyId, from, to);
  const csv = toCsv(
    [
      "GSTIN/UIN of Recipient",
      "Receiver Name",
      "Invoice Number",
      "Invoice Date",
      "Invoice Value",
      "Invoice Type",
      "Place Of Supply",
      "Reverse Charge",
      "Rate",
      "Taxable Value",
      "CGST",
      "SGST",
      "IGST",
      "HSN/SAC",
    ],
    registers.outputRows.map((row) => [
      row.partyGstin ?? "",
      row.partyName,
      row.documentNumber,
      dateCell(row.documentDate),
      row.grandTotal,
      gstrInvoiceType(row),
      "",
      "N",
      taxRateCell(row),
      row.taxableAmount,
      row.cgstAmount,
      row.sgstAmount,
      row.igstAmount,
      row.hsnCodes.join("|"),
    ]),
  );
  res.header("content-type", "text/csv; charset=utf-8").attachment("rams-gstr-1.csv").send(csv);
}));

router.get("/accounting/gstr-2.csv", asyncHandler(async (req, res) => {
  const { from, to } = parseReportDateRange(req.query);
  const registers = await getGstRegisters(req.user!.companyId, from, to);
  const csv = toCsv(
    [
      "GSTIN of Supplier",
      "Supplier Name",
      "Invoice Number",
      "Invoice Date",
      "Invoice Value",
      "Invoice Type",
      "Place Of Supply",
      "Reverse Charge",
      "Rate",
      "Taxable Value",
      "CGST",
      "SGST",
      "IGST",
      "HSN/SAC",
    ],
    registers.inputRows.map((row) => [
      row.partyGstin ?? "",
      row.partyName,
      row.documentNumber,
      dateCell(row.documentDate),
      row.grandTotal,
      gstrInvoiceType(row),
      "",
      "N",
      taxRateCell(row),
      row.taxableAmount,
      row.cgstAmount,
      row.sgstAmount,
      row.igstAmount,
      row.hsnCodes.join("|"),
    ]),
  );
  res.header("content-type", "text/csv; charset=utf-8").attachment("rams-gstr-2.csv").send(csv);
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
