import { Prisma } from "../../generated/prisma/client";
import prisma from "../../lib/prisma";
import type { RequestContext } from "../../types/request-context";
import { ApiError } from "../../utils/api-error";
import { formatDocumentNumber } from "../number-series/number-series.service";

type AccountingContext = RequestContext & {
  companyId: string;
  userId: string;
};

type JournalLineInput = {
  accountId?: unknown;
  debitAmount?: unknown;
  creditAmount?: unknown;
  narration?: unknown;
};

const defaultAccounts = [
  { code: "1000", name: "Cash", accountType: "ASSET" },
  { code: "1010", name: "Bank", accountType: "ASSET" },
  { code: "1100", name: "Accounts Receivable", accountType: "ASSET" },
  { code: "1200", name: "Inventory", accountType: "ASSET" },
  { code: "2000", name: "Accounts Payable", accountType: "LIABILITY" },
  { code: "2100", name: "GST Payable", accountType: "LIABILITY" },
  { code: "2200", name: "GST Input Credit", accountType: "ASSET" },
  { code: "3000", name: "Owner Equity", accountType: "EQUITY" },
  { code: "4000", name: "Sales Revenue", accountType: "INCOME" },
  { code: "5000", name: "Cost of Goods Sold", accountType: "EXPENSE" },
  { code: "5100", name: "Purchase Expense", accountType: "EXPENSE" },
] as const;

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_ACCOUNTING_INPUT", `${field} is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function amount(value: unknown) {
  const number = value === undefined || value === null || value === "" ? 0 : Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new ApiError(400, "INVALID_AMOUNT", "Amounts must be non-negative.");
  }

  return new Prisma.Decimal(number.toFixed(2));
}

function entryDate(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "INVALID_DATE", "Entry date is invalid.");
  }

  return date;
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function nextJournalNumber(tx: Prisma.TransactionClient, companyId: string) {
  const series = await tx.numberSeries.findFirst({
    where: { companyId, documentType: "JOURNAL_ENTRY", status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });

  if (!series) {
    throw new ApiError(400, "NUMBER_SERIES_MISSING", "Create a JOURNAL_ENTRY number series before posting journals.");
  }

  await tx.numberSeries.update({
    where: { id: series.id },
    data: { nextNumber: { increment: 1 } },
  });

  return formatDocumentNumber(series);
}

export async function seedDefaultAccounts(context: AccountingContext) {
  const accounts = await prisma.$transaction(async (tx) => {
    const created = [];

    for (const account of defaultAccounts) {
      created.push(
        await tx.account.upsert({
          where: { companyId_code: { companyId: context.companyId, code: account.code } },
          create: { ...account, companyId: context.companyId, isSystem: true },
          update: { name: account.name, accountType: account.accountType, isSystem: true, status: "ACTIVE" },
        }),
      );
    }

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "accounting",
        action: "CREATE",
        entityType: "ChartOfAccounts",
        description: "Default chart of accounts seeded.",
        afterData: toJsonInput(created),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return created;
  });

  return accounts;
}

export async function listAccounts(companyId: string) {
  return prisma.account.findMany({
    where: { companyId },
    orderBy: [{ code: "asc" }],
  });
}

export async function createAccount(context: AccountingContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const accountType = requiredString(data.accountType, "Account type").toUpperCase();

  if (!["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].includes(accountType)) {
    throw new ApiError(400, "INVALID_ACCOUNT_TYPE", "Account type is invalid.");
  }

  const account = await prisma.account.create({
    data: {
      companyId: context.companyId,
      parentId: optionalString(data.parentId),
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      accountType: accountType as "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE",
    },
  });

  return account;
}

export async function getAccountingSummary(companyId: string) {
  const [accounts, postedJournals, lines] = await Promise.all([
    prisma.account.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.journalEntry.count({ where: { companyId, status: "POSTED" } }),
    prisma.journalLine.aggregate({
      where: { journalEntry: { companyId, status: "POSTED" } },
      _sum: { debitAmount: true, creditAmount: true },
    }),
  ]);

  return {
    accounts,
    postedJournals,
    debitTotal: lines._sum.debitAmount ?? 0,
    creditTotal: lines._sum.creditAmount ?? 0,
  };
}

export async function listJournalEntries(companyId: string) {
  return prisma.journalEntry.findMany({
    where: { companyId },
    include: { lines: { include: { account: true }, orderBy: { lineOrder: "asc" } } },
    orderBy: { entryDate: "desc" },
    take: 50,
  });
}

export async function listPartyLedgerEntries(companyId: string, partyType?: string) {
  const normalizedPartyType = partyType?.trim().toUpperCase();

  if (normalizedPartyType && !["CUSTOMER", "SUPPLIER"].includes(normalizedPartyType)) {
    throw new ApiError(400, "INVALID_PARTY_TYPE", "Party type must be CUSTOMER or SUPPLIER.");
  }

  return prisma.partyLedgerEntry.findMany({
    where: {
      companyId,
      ...(normalizedPartyType ? { partyType: normalizedPartyType as "CUSTOMER" | "SUPPLIER" } : {}),
    },
    include: { customer: true, supplier: true, journalEntry: true },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function getPartyLedgerSummary(companyId: string) {
  const [customerTotals, supplierTotals] = await Promise.all([
    prisma.partyLedgerEntry.aggregate({
      where: { companyId, partyType: "CUSTOMER" },
      _sum: { debitAmount: true, creditAmount: true },
    }),
    prisma.partyLedgerEntry.aggregate({
      where: { companyId, partyType: "SUPPLIER" },
      _sum: { debitAmount: true, creditAmount: true },
    }),
  ]);
  const customerDebit = new Prisma.Decimal(customerTotals._sum.debitAmount ?? 0);
  const customerCredit = new Prisma.Decimal(customerTotals._sum.creditAmount ?? 0);
  const supplierDebit = new Prisma.Decimal(supplierTotals._sum.debitAmount ?? 0);
  const supplierCredit = new Prisma.Decimal(supplierTotals._sum.creditAmount ?? 0);

  return {
    customerBalance: customerDebit.minus(customerCredit),
    supplierBalance: supplierCredit.minus(supplierDebit),
  };
}

export async function getGstSummary(companyId: string) {
  const [purchaseTotals, salesTotals] = await Promise.all([
    prisma.purchaseInvoice.aggregate({
      where: { companyId, status: "POSTED" },
      _sum: { cgstAmount: true, sgstAmount: true, igstAmount: true, totalTaxAmount: true },
    }),
    prisma.salesInvoice.aggregate({
      where: { companyId, status: "POSTED" },
      _sum: { cgstAmount: true, sgstAmount: true, igstAmount: true, totalTaxAmount: true },
    }),
  ]);
  const inputTax = new Prisma.Decimal(purchaseTotals._sum.totalTaxAmount ?? 0);
  const outputTax = new Prisma.Decimal(salesTotals._sum.totalTaxAmount ?? 0);

  return {
    inputCgst: purchaseTotals._sum.cgstAmount ?? 0,
    inputSgst: purchaseTotals._sum.sgstAmount ?? 0,
    inputIgst: purchaseTotals._sum.igstAmount ?? 0,
    outputCgst: salesTotals._sum.cgstAmount ?? 0,
    outputSgst: salesTotals._sum.sgstAmount ?? 0,
    outputIgst: salesTotals._sum.igstAmount ?? 0,
    inputTax,
    outputTax,
    netPayable: outputTax.minus(inputTax),
  };
}

export async function postJournalEntry(context: AccountingContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const rawLines = Array.isArray(data.lines) ? (data.lines as JournalLineInput[]) : [];

  if (rawLines.length < 2) {
    throw new ApiError(400, "INVALID_JOURNAL", "A journal entry requires at least two lines.");
  }

  const lines = rawLines.map((line, index) => {
    const debitAmount = amount(line.debitAmount);
    const creditAmount = amount(line.creditAmount);

    if (debitAmount.gt(0) === creditAmount.gt(0)) {
      throw new ApiError(400, "INVALID_JOURNAL_LINE", "Each line must contain either debit or credit amount.");
    }

    return {
      accountId: requiredString(line.accountId, "Account"),
      debitAmount,
      creditAmount,
      narration: optionalString(line.narration),
      lineOrder: index + 1,
    };
  });

  const debitTotal = lines.reduce((total, line) => total.plus(line.debitAmount), new Prisma.Decimal(0));
  const creditTotal = lines.reduce((total, line) => total.plus(line.creditAmount), new Prisma.Decimal(0));

  if (!debitTotal.equals(creditTotal)) {
    throw new ApiError(400, "UNBALANCED_JOURNAL", "Journal debit and credit totals must match.");
  }

  return prisma.$transaction(async (tx) => {
    const accountCount = await tx.account.count({
      where: {
        companyId: context.companyId,
        status: "ACTIVE",
        id: { in: lines.map((line) => line.accountId) },
      },
    });

    if (accountCount !== new Set(lines.map((line) => line.accountId)).size) {
      throw new ApiError(400, "INVALID_ACCOUNT", "One or more accounts are invalid or inactive.");
    }

    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId: context.companyId,
        entryNumber: await nextJournalNumber(tx, context.companyId),
        entryDate: entryDate(data.entryDate),
        sourceModule: optionalString(data.sourceModule) ?? "accounting",
        sourceType: optionalString(data.sourceType) ?? "MANUAL_JOURNAL",
        sourceId: optionalString(data.sourceId),
        narration: optionalString(data.narration),
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: { create: lines },
      },
      include: { lines: { include: { account: true }, orderBy: { lineOrder: "asc" } } },
    });

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "accounting",
        action: "POST",
        entityType: "JournalEntry",
        entityId: journalEntry.id,
        description: "Journal entry posted.",
        afterData: toJsonInput(journalEntry),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return journalEntry;
  });
}
