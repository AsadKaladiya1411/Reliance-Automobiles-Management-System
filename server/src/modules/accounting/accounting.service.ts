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

type ContraVoucherInput = {
  voucherDate?: unknown;
  fromAccountId?: unknown;
  toAccountId?: unknown;
  amount?: unknown;
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

function optionalDate(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "INVALID_DATE", `${field} is invalid.`);
  }

  return date;
}

function dateRange(from?: Date, to?: Date) {
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
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

export async function getTrialBalance(companyId: string) {
  const balances = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: { journalEntry: { companyId, status: "POSTED" } },
    _sum: { debitAmount: true, creditAmount: true },
  });
  const accounts = await prisma.account.findMany({
    where: { companyId, id: { in: balances.map((balance) => balance.accountId) } },
    orderBy: [{ code: "asc" }],
  });
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const rows = balances
    .map((balance) => {
      const account = accountMap.get(balance.accountId);
      const debitTotal = new Prisma.Decimal(balance._sum.debitAmount ?? 0);
      const creditTotal = new Prisma.Decimal(balance._sum.creditAmount ?? 0);
      const net = debitTotal.minus(creditTotal);

      return {
        account,
        debitTotal,
        creditTotal,
        debitBalance: net.gt(0) ? net : new Prisma.Decimal(0),
        creditBalance: net.lt(0) ? net.abs() : new Prisma.Decimal(0),
      };
    })
    .filter((row) => row.account);

  return {
    rows,
    debitTotal: rows.reduce((total, row) => total.plus(row.debitTotal), new Prisma.Decimal(0)),
    creditTotal: rows.reduce((total, row) => total.plus(row.creditTotal), new Prisma.Decimal(0)),
    debitBalanceTotal: rows.reduce((total, row) => total.plus(row.debitBalance), new Prisma.Decimal(0)),
    creditBalanceTotal: rows.reduce((total, row) => total.plus(row.creditBalance), new Prisma.Decimal(0)),
  };
}

export async function listGeneralLedger(companyId: string, accountId?: string) {
  const normalizedAccountId = accountId?.trim();

  if (normalizedAccountId) {
    const account = await prisma.account.findFirst({ where: { id: normalizedAccountId, companyId } });
    if (!account) {
      throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Account not found.");
    }
  }

  const lines = await prisma.journalLine.findMany({
    where: {
      ...(normalizedAccountId ? { accountId: normalizedAccountId } : {}),
      journalEntry: { companyId, status: "POSTED" },
    },
    include: { account: true, journalEntry: true },
    orderBy: [{ journalEntry: { entryDate: "desc" } }, { createdAt: "desc" }],
    take: 200,
  });

  return lines.map((line) => ({
    id: line.id,
    account: line.account,
    entryNumber: line.journalEntry.entryNumber,
    entryDate: line.journalEntry.entryDate,
    sourceModule: line.journalEntry.sourceModule,
    sourceType: line.journalEntry.sourceType,
    debitAmount: line.debitAmount,
    creditAmount: line.creditAmount,
    narration: line.narration ?? line.journalEntry.narration,
  }));
}

async function accountBalances(companyId: string, accountTypes: Array<"ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE">) {
  const accounts = await prisma.account.findMany({
    where: { companyId, accountType: { in: accountTypes }, status: "ACTIVE" },
    orderBy: [{ code: "asc" }],
  });
  const balances = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      accountId: { in: accounts.map((account) => account.id) },
      journalEntry: { companyId, status: "POSTED" },
    },
    _sum: { debitAmount: true, creditAmount: true },
  });
  const balanceMap = new Map(balances.map((balance) => [balance.accountId, balance]));

  return accounts.map((account) => {
    const balance = balanceMap.get(account.id);
    const debitTotal = new Prisma.Decimal(balance?._sum.debitAmount ?? 0);
    const creditTotal = new Prisma.Decimal(balance?._sum.creditAmount ?? 0);

    return { account, debitTotal, creditTotal };
  });
}

export async function getProfitAndLoss(companyId: string) {
  const rows = await accountBalances(companyId, ["INCOME", "EXPENSE"]);
  const income = rows
    .filter((row) => row.account.accountType === "INCOME")
    .map((row) => ({ ...row, amount: row.creditTotal.minus(row.debitTotal) }));
  const expenses = rows
    .filter((row) => row.account.accountType === "EXPENSE")
    .map((row) => ({ ...row, amount: row.debitTotal.minus(row.creditTotal) }));
  const totalIncome = income.reduce((total, row) => total.plus(row.amount), new Prisma.Decimal(0));
  const totalExpenses = expenses.reduce((total, row) => total.plus(row.amount), new Prisma.Decimal(0));

  return {
    income,
    expenses,
    totalIncome,
    totalExpenses,
    netProfit: totalIncome.minus(totalExpenses),
  };
}

export async function getBalanceSheet(companyId: string) {
  const rows = await accountBalances(companyId, ["ASSET", "LIABILITY", "EQUITY"]);
  const assets = rows
    .filter((row) => row.account.accountType === "ASSET")
    .map((row) => ({ ...row, amount: row.debitTotal.minus(row.creditTotal) }));
  const liabilities = rows
    .filter((row) => row.account.accountType === "LIABILITY")
    .map((row) => ({ ...row, amount: row.creditTotal.minus(row.debitTotal) }));
  const equity = rows
    .filter((row) => row.account.accountType === "EQUITY")
    .map((row) => ({ ...row, amount: row.creditTotal.minus(row.debitTotal) }));
  const totalAssets = assets.reduce((total, row) => total.plus(row.amount), new Prisma.Decimal(0));
  const totalLiabilities = liabilities.reduce((total, row) => total.plus(row.amount), new Prisma.Decimal(0));
  const totalEquity = equity.reduce((total, row) => total.plus(row.amount), new Prisma.Decimal(0));

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity: totalLiabilities.plus(totalEquity),
  };
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

export async function getPartyOutstanding(companyId: string) {
  const [customerLedger, supplierLedger] = await Promise.all([
    prisma.partyLedgerEntry.groupBy({
      by: ["customerId"],
      where: { companyId, partyType: "CUSTOMER", customerId: { not: null } },
      _sum: { debitAmount: true, creditAmount: true },
    }),
    prisma.partyLedgerEntry.groupBy({
      by: ["supplierId"],
      where: { companyId, partyType: "SUPPLIER", supplierId: { not: null } },
      _sum: { debitAmount: true, creditAmount: true },
    }),
  ]);
  const [customers, suppliers] = await Promise.all([
    prisma.customer.findMany({
      where: { id: { in: customerLedger.map((entry) => entry.customerId).filter(Boolean) as string[] } },
      select: { id: true, code: true, name: true, phone: true, creditLimit: true, creditDays: true },
    }),
    prisma.supplier.findMany({
      where: { id: { in: supplierLedger.map((entry) => entry.supplierId).filter(Boolean) as string[] } },
      select: { id: true, code: true, name: true, phone: true },
    }),
  ]);
  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

  return {
    customers: customerLedger
      .map((entry) => {
        const debit = new Prisma.Decimal(entry._sum.debitAmount ?? 0);
        const credit = new Prisma.Decimal(entry._sum.creditAmount ?? 0);
        const party = customerMap.get(entry.customerId ?? "");
        const balance = debit.minus(credit);
        const creditLimit = new Prisma.Decimal(party?.creditLimit ?? 0);
        const creditAvailable = creditLimit.gt(0) ? creditLimit.minus(balance) : new Prisma.Decimal(0);
        const creditStatus = creditLimit.gt(0) && balance.gt(creditLimit) ? "LIMIT_EXCEEDED" : "OK";

        return {
          party,
          debit,
          credit,
          balance,
          creditLimit,
          creditAvailable,
          creditStatus,
        };
      })
      .filter((entry) => entry.party && !entry.balance.equals(0)),
    suppliers: supplierLedger
      .map((entry) => {
        const debit = new Prisma.Decimal(entry._sum.debitAmount ?? 0);
        const credit = new Prisma.Decimal(entry._sum.creditAmount ?? 0);
        return {
          party: supplierMap.get(entry.supplierId ?? ""),
          debit,
          credit,
          balance: credit.minus(debit),
        };
      })
      .filter((entry) => entry.party && !entry.balance.equals(0)),
  };
}

export async function getGstSummary(companyId: string, from?: Date, to?: Date) {
  const [purchaseTotals, purchaseReturnTotals, salesTotals, salesReturnTotals, workshopTotals] = await Promise.all([
    prisma.purchaseInvoice.aggregate({
      where: { companyId, status: "POSTED", invoiceDate: dateRange(from, to) },
      _sum: { cgstAmount: true, sgstAmount: true, igstAmount: true, totalTaxAmount: true },
    }),
    prisma.purchaseReturn.aggregate({
      where: { companyId, returnDate: dateRange(from, to) },
      _sum: { cgstAmount: true, sgstAmount: true, igstAmount: true, totalTaxAmount: true },
    }),
    prisma.salesInvoice.aggregate({
      where: { companyId, status: "POSTED", invoiceDate: dateRange(from, to) },
      _sum: { cgstAmount: true, sgstAmount: true, igstAmount: true, totalTaxAmount: true },
    }),
    prisma.salesReturn.aggregate({
      where: { companyId, returnDate: dateRange(from, to) },
      _sum: { cgstAmount: true, sgstAmount: true, igstAmount: true, totalTaxAmount: true },
    }),
    prisma.jobCard.aggregate({
      where: { companyId, billedAt: { not: null, ...dateRange(from, to) } },
      _sum: {
        billingCgstAmount: true,
        billingSgstAmount: true,
        billingIgstAmount: true,
        billingTotalTaxAmount: true,
      },
    }),
  ]);
  const inputCgst = new Prisma.Decimal(purchaseTotals._sum.cgstAmount ?? 0).minus(purchaseReturnTotals._sum.cgstAmount ?? 0);
  const inputSgst = new Prisma.Decimal(purchaseTotals._sum.sgstAmount ?? 0).minus(purchaseReturnTotals._sum.sgstAmount ?? 0);
  const inputIgst = new Prisma.Decimal(purchaseTotals._sum.igstAmount ?? 0).minus(purchaseReturnTotals._sum.igstAmount ?? 0);
  const outputCgst = new Prisma.Decimal(salesTotals._sum.cgstAmount ?? 0)
    .plus(workshopTotals._sum.billingCgstAmount ?? 0)
    .minus(salesReturnTotals._sum.cgstAmount ?? 0);
  const outputSgst = new Prisma.Decimal(salesTotals._sum.sgstAmount ?? 0)
    .plus(workshopTotals._sum.billingSgstAmount ?? 0)
    .minus(salesReturnTotals._sum.sgstAmount ?? 0);
  const outputIgst = new Prisma.Decimal(salesTotals._sum.igstAmount ?? 0)
    .plus(workshopTotals._sum.billingIgstAmount ?? 0)
    .minus(salesReturnTotals._sum.igstAmount ?? 0);
  const inputTax = new Prisma.Decimal(purchaseTotals._sum.totalTaxAmount ?? 0).minus(purchaseReturnTotals._sum.totalTaxAmount ?? 0);
  const outputTax = new Prisma.Decimal(salesTotals._sum.totalTaxAmount ?? 0)
    .plus(workshopTotals._sum.billingTotalTaxAmount ?? 0)
    .minus(salesReturnTotals._sum.totalTaxAmount ?? 0);

  return {
    inputCgst,
    inputSgst,
    inputIgst,
    outputCgst,
    outputSgst,
    outputIgst,
    inputTax,
    outputTax,
    netPayable: outputTax.minus(inputTax),
  };
}

export function parseReportDateRange(query: Record<string, unknown>) {
  const from = optionalDate(query.from, "From date");
  const to = optionalDate(query.to, "To date");

  if (from && to && from > to) {
    throw new ApiError(400, "INVALID_DATE_RANGE", "From date must be before or equal to To date.");
  }

  return { from, to };
}

function sumRegisterRows(rows: Array<{ taxableAmount: Prisma.Decimal; cgstAmount: Prisma.Decimal; sgstAmount: Prisma.Decimal; igstAmount: Prisma.Decimal; totalTaxAmount: Prisma.Decimal; grandTotal: Prisma.Decimal }>) {
  return rows.reduce(
    (totals, row) => ({
      taxableAmount: totals.taxableAmount.plus(row.taxableAmount),
      cgstAmount: totals.cgstAmount.plus(row.cgstAmount),
      sgstAmount: totals.sgstAmount.plus(row.sgstAmount),
      igstAmount: totals.igstAmount.plus(row.igstAmount),
      totalTaxAmount: totals.totalTaxAmount.plus(row.totalTaxAmount),
      grandTotal: totals.grandTotal.plus(row.grandTotal),
    }),
    {
      taxableAmount: new Prisma.Decimal(0),
      cgstAmount: new Prisma.Decimal(0),
      sgstAmount: new Prisma.Decimal(0),
      igstAmount: new Prisma.Decimal(0),
      totalTaxAmount: new Prisma.Decimal(0),
      grandTotal: new Prisma.Decimal(0),
    },
  );
}

export async function getGstRegisters(companyId: string, from?: Date, to?: Date) {
  const [purchaseInvoices, purchaseReturns, salesInvoices, salesReturns, workshopInvoices] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: { companyId, status: "POSTED", invoiceDate: dateRange(from, to) },
      include: { supplier: true, lines: { include: { productVariant: true }, orderBy: { lineOrder: "asc" } } },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
      take: 250,
    }),
    prisma.purchaseReturn.findMany({
      where: { companyId, returnDate: dateRange(from, to) },
      include: { supplier: true, lines: { include: { productVariant: true }, orderBy: { lineOrder: "asc" } } },
      orderBy: [{ returnDate: "desc" }, { createdAt: "desc" }],
      take: 250,
    }),
    prisma.salesInvoice.findMany({
      where: { companyId, status: "POSTED", invoiceDate: dateRange(from, to) },
      include: { customer: true, lines: { include: { productVariant: true }, orderBy: { lineOrder: "asc" } } },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
      take: 250,
    }),
    prisma.salesReturn.findMany({
      where: { companyId, returnDate: dateRange(from, to) },
      include: { customer: true, lines: { include: { productVariant: true }, orderBy: { lineOrder: "asc" } } },
      orderBy: [{ returnDate: "desc" }, { createdAt: "desc" }],
      take: 250,
    }),
    prisma.jobCard.findMany({
      where: { companyId, billedAt: { not: null, ...dateRange(from, to) } },
      include: { customer: true, vehicle: true },
      orderBy: [{ billedAt: "desc" }, { jobDate: "desc" }],
      take: 250,
    }),
  ]);

  const inputRows = [
    ...purchaseInvoices.map((invoice) => ({
      id: invoice.id,
      module: "purchase",
      documentType: "PURCHASE_INVOICE",
      documentNumber: invoice.invoiceNumber,
      documentDate: invoice.invoiceDate,
      partyName: invoice.supplier.name,
      partyGstin: invoice.supplier.gstin,
      taxMode: invoice.taxMode,
      hsnCodes: [...new Set(invoice.lines.map((line) => line.hsnCode).filter(Boolean))],
      taxableAmount: invoice.taxableAmount,
      cgstAmount: invoice.cgstAmount,
      sgstAmount: invoice.sgstAmount,
      igstAmount: invoice.igstAmount,
      totalTaxAmount: invoice.totalTaxAmount,
      grandTotal: invoice.grandTotal,
    })),
    ...purchaseReturns.map((purchaseReturn) => ({
      id: purchaseReturn.id,
      module: "purchase",
      documentType: "PURCHASE_RETURN",
      documentNumber: purchaseReturn.returnNumber,
      documentDate: purchaseReturn.returnDate,
      partyName: purchaseReturn.supplier.name,
      partyGstin: purchaseReturn.supplier.gstin,
      taxMode: "RETURN",
      hsnCodes: [...new Set(purchaseReturn.lines.map((line) => line.hsnCode).filter(Boolean))],
      taxableAmount: purchaseReturn.taxableAmount.neg(),
      cgstAmount: purchaseReturn.cgstAmount.neg(),
      sgstAmount: purchaseReturn.sgstAmount.neg(),
      igstAmount: purchaseReturn.igstAmount.neg(),
      totalTaxAmount: purchaseReturn.totalTaxAmount.neg(),
      grandTotal: purchaseReturn.grandTotal.neg(),
    })),
  ];
  const outputRows = [
    ...salesInvoices.map((invoice) => ({
      id: invoice.id,
      module: "sales",
      documentType: "SALES_INVOICE",
      documentNumber: invoice.invoiceNumber,
      documentDate: invoice.invoiceDate,
      partyName: invoice.customer.name,
      partyGstin: invoice.customer.gstin,
      taxMode: invoice.taxMode,
      hsnCodes: [...new Set(invoice.lines.map((line) => line.hsnCode).filter(Boolean))],
      taxableAmount: invoice.taxableAmount,
      cgstAmount: invoice.cgstAmount,
      sgstAmount: invoice.sgstAmount,
      igstAmount: invoice.igstAmount,
      totalTaxAmount: invoice.totalTaxAmount,
      grandTotal: invoice.grandTotal,
    })),
    ...salesReturns.map((salesReturn) => ({
      id: salesReturn.id,
      module: "sales",
      documentType: "SALES_RETURN",
      documentNumber: salesReturn.returnNumber,
      documentDate: salesReturn.returnDate,
      partyName: salesReturn.customer.name,
      partyGstin: salesReturn.customer.gstin,
      taxMode: "RETURN",
      hsnCodes: [...new Set(salesReturn.lines.map((line) => line.hsnCode).filter(Boolean))],
      taxableAmount: salesReturn.taxableAmount.neg(),
      cgstAmount: salesReturn.cgstAmount.neg(),
      sgstAmount: salesReturn.sgstAmount.neg(),
      igstAmount: salesReturn.igstAmount.neg(),
      totalTaxAmount: salesReturn.totalTaxAmount.neg(),
      grandTotal: salesReturn.grandTotal.neg(),
    })),
    ...workshopInvoices.map((jobCard) => ({
      id: jobCard.id,
      module: "workshop",
      documentType: "WORKSHOP_INVOICE",
      documentNumber: jobCard.billingNumber ?? jobCard.jobCardNumber,
      documentDate: jobCard.billedAt ?? jobCard.jobDate,
      partyName: `${jobCard.customer.name} / ${jobCard.vehicle.registrationNumber}`,
      partyGstin: jobCard.customer.gstin,
      taxMode: jobCard.billingTaxMode,
      hsnCodes: jobCard.billingHsnCode ? [jobCard.billingHsnCode] : [],
      taxableAmount: jobCard.billingTaxableAmount,
      cgstAmount: jobCard.billingCgstAmount,
      sgstAmount: jobCard.billingSgstAmount,
      igstAmount: jobCard.billingIgstAmount,
      totalTaxAmount: jobCard.billingTotalTaxAmount,
      grandTotal: jobCard.billingAmount,
    })),
  ];

  return {
    inputRows,
    outputRows,
    inputTotals: sumRegisterRows(inputRows),
    outputTotals: sumRegisterRows(outputRows),
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

export async function postContraVoucher(context: AccountingContext, body: unknown) {
  const data = body as ContraVoucherInput;
  const fromAccountId = requiredString(data.fromAccountId, "From account");
  const toAccountId = requiredString(data.toAccountId, "To account");
  const voucherAmount = amount(data.amount);
  const voucherDate = entryDate(data.voucherDate);

  if (fromAccountId === toAccountId) {
    throw new ApiError(400, "INVALID_CONTRA_ACCOUNTS", "From and to accounts must be different.");
  }

  if (!voucherAmount.gt(0)) {
    throw new ApiError(400, "INVALID_CONTRA_AMOUNT", "Contra amount must be greater than zero.");
  }

  return prisma.$transaction(async (tx) => {
    const accounts = await tx.account.findMany({
      where: {
        companyId: context.companyId,
        id: { in: [fromAccountId, toAccountId] },
        status: "ACTIVE",
        accountType: "ASSET",
      },
    });

    if (accounts.length !== 2) {
      throw new ApiError(400, "INVALID_CONTRA_ACCOUNT", "Contra accounts must be active asset accounts.");
    }

    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId: context.companyId,
        entryNumber: await nextJournalNumber(tx, context.companyId),
        entryDate: voucherDate,
        sourceModule: "accounting",
        sourceType: "CONTRA_VOUCHER",
        narration: optionalString(data.narration) ?? "Contra voucher",
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: toAccountId, debitAmount: voucherAmount, narration: "Contra transfer in", lineOrder: 1 },
            { accountId: fromAccountId, creditAmount: voucherAmount, narration: "Contra transfer out", lineOrder: 2 },
          ],
        },
      },
      include: { lines: { include: { account: true }, orderBy: { lineOrder: "asc" } } },
    });

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "accounting",
        action: "POST",
        entityType: "ContraVoucher",
        entityId: journalEntry.id,
        description: "Contra voucher posted.",
        afterData: toJsonInput(journalEntry),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return journalEntry;
  });
}
