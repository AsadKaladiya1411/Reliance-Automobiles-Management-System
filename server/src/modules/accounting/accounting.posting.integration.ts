import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import { postJournalEntry } from "./accounting.service";

async function cleanupCompany(companyId: string) {
  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.journalEntry.deleteMany({ where: { companyId } });
  await prisma.account.deleteMany({ where: { companyId } });
  await prisma.numberSeries.deleteMany({ where: { companyId } });
  await prisma.financialYear.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

test("manual journal posting creates balanced journal lines and audit log inside an open financial year", async () => {
  const suffix = Date.now().toString(36);
  const company = await prisma.company.create({
    data: {
      code: `INT-${suffix}`,
      name: `Integration Company ${suffix}`,
    },
  });

  try {
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        username: `integration-${suffix}`,
        email: `integration-${suffix}@rams.test`,
        fullName: "Integration Tester",
        passwordHash: "not-used-in-integration-test",
      },
    });
    const [cashAccount, equityAccount] = await Promise.all([
      prisma.account.create({
        data: {
          companyId: company.id,
          code: "1000",
          name: "Cash",
          accountType: "ASSET",
        },
      }),
      prisma.account.create({
        data: {
          companyId: company.id,
          code: "3000",
          name: "Owner Equity",
          accountType: "EQUITY",
        },
      }),
      prisma.financialYear.create({
        data: {
          companyId: company.id,
          name: "FY-TEST",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2027-03-31"),
          status: "OPEN",
        },
      }),
      prisma.numberSeries.create({
        data: {
          companyId: company.id,
          documentType: "JOURNAL_ENTRY",
          prefix: "JV-T-",
          padding: 4,
          nextNumber: 1,
          resetPolicy: "NEVER",
        },
      }),
    ]);

    const journal = await postJournalEntry(
      {
        companyId: company.id,
        userId: user.id,
        ipAddress: "127.0.0.1",
        userAgent: "integration-test",
      },
      {
        entryDate: "2026-07-31",
        narration: "Integration opening capital",
        lines: [
          { accountId: cashAccount.id, debitAmount: 1000 },
          { accountId: equityAccount.id, creditAmount: 1000 },
        ],
      },
    );

    assert.equal(journal.entryNumber, "JV-T-0001");
    assert.equal(journal.status, "POSTED");
    assert.equal(journal.lines.length, 2);

    const [journalCount, auditCount, series] = await Promise.all([
      prisma.journalEntry.count({ where: { companyId: company.id } }),
      prisma.auditLog.count({ where: { companyId: company.id, module: "accounting", action: "POST" } }),
      prisma.numberSeries.findFirst({ where: { companyId: company.id, documentType: "JOURNAL_ENTRY" } }),
    ]);

    assert.equal(journalCount, 1);
    assert.equal(auditCount, 1);
    assert.equal(series?.nextNumber, 2);
  } finally {
    await cleanupCompany(company.id);
  }
});

test("manual journal posting rejects dates outside an open financial year", async () => {
  const suffix = Date.now().toString(36);
  const company = await prisma.company.create({
    data: {
      code: `INT-CLOSED-${suffix}`,
      name: `Integration Closed Company ${suffix}`,
    },
  });

  try {
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        username: `integration-closed-${suffix}`,
        email: `integration-closed-${suffix}@rams.test`,
        fullName: "Integration Tester",
        passwordHash: "not-used-in-integration-test",
      },
    });
    const [cashAccount, equityAccount] = await Promise.all([
      prisma.account.create({
        data: {
          companyId: company.id,
          code: "1000",
          name: "Cash",
          accountType: "ASSET",
        },
      }),
      prisma.account.create({
        data: {
          companyId: company.id,
          code: "3000",
          name: "Owner Equity",
          accountType: "EQUITY",
        },
      }),
      prisma.financialYear.create({
        data: {
          companyId: company.id,
          name: "FY-CLOSED",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2027-03-31"),
          status: "CLOSED",
        },
      }),
      prisma.numberSeries.create({
        data: {
          companyId: company.id,
          documentType: "JOURNAL_ENTRY",
          prefix: "JV-C-",
          padding: 4,
          nextNumber: 1,
          resetPolicy: "NEVER",
        },
      }),
    ]);

    await assert.rejects(
      () =>
        postJournalEntry(
          {
            companyId: company.id,
            userId: user.id,
            ipAddress: "127.0.0.1",
            userAgent: "integration-test",
          },
          {
            entryDate: "2026-07-31",
            narration: "Closed year posting",
            lines: [
              { accountId: cashAccount.id, debitAmount: 1000 },
              { accountId: equityAccount.id, creditAmount: 1000 },
            ],
          },
        ),
      (error: unknown) => error instanceof ApiError && error.code === "FINANCIAL_YEAR_NOT_OPEN",
    );

    const [journalCount, auditCount, series] = await Promise.all([
      prisma.journalEntry.count({ where: { companyId: company.id } }),
      prisma.auditLog.count({ where: { companyId: company.id } }),
      prisma.numberSeries.findFirst({ where: { companyId: company.id, documentType: "JOURNAL_ENTRY" } }),
    ]);

    assert.equal(journalCount, 0);
    assert.equal(auditCount, 0);
    assert.equal(series?.nextNumber, 1);
  } finally {
    await cleanupCompany(company.id);
  }
});
