import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import { postSalesInvoice } from "./sales.service";

type SalesFixture = {
  companyId: string;
  userId: string;
  customerId: string;
  productId: string;
  productVariantId: string;
  warehouseId: string;
};

async function cleanupCompany(companyId: string) {
  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.partyLedgerEntry.deleteMany({ where: { companyId } });
  await prisma.salesInvoiceLine.deleteMany({ where: { companyId } });
  await prisma.salesInvoice.deleteMany({ where: { companyId } });
  await prisma.stockMovement.deleteMany({ where: { companyId } });
  await prisma.stockBalance.deleteMany({ where: { companyId } });
  await prisma.journalEntry.deleteMany({ where: { companyId } });
  await prisma.account.deleteMany({ where: { companyId } });
  await prisma.productVariant.deleteMany({ where: { companyId } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.taxRate.deleteMany({ where: { companyId } });
  await prisma.hsnCode.deleteMany({ where: { companyId } });
  await prisma.warehouse.deleteMany({ where: { companyId } });
  await prisma.customer.deleteMany({ where: { companyId } });
  await prisma.category.deleteMany({ where: { companyId } });
  await prisma.unit.deleteMany({ where: { companyId } });
  await prisma.numberSeries.deleteMany({ where: { companyId } });
  await prisma.financialYear.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

async function createSalesFixture(): Promise<SalesFixture> {
  const suffix = Date.now().toString(36);
  const company = await prisma.company.create({
    data: {
      code: `SALE-${suffix}`,
      name: `Sales Integration ${suffix}`,
    },
  });
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      username: `sales-${suffix}`,
      email: `sales-${suffix}@rams.test`,
      fullName: "Sales Integration Tester",
      passwordHash: "not-used-in-integration-test",
    },
  });
  const [customer, unit, category, warehouse, hsnCode] = await Promise.all([
    prisma.customer.create({
      data: {
        companyId: company.id,
        code: "CUST",
        name: "Cash Customer",
      },
    }),
    prisma.unit.create({
      data: {
        companyId: company.id,
        code: "PCS",
        name: "Pieces",
        symbol: "pcs",
      },
    }),
    prisma.category.create({
      data: {
        companyId: company.id,
        code: "FILTERS",
        name: "Filters",
      },
    }),
    prisma.warehouse.create({
      data: {
        companyId: company.id,
        code: "MAIN",
        name: "Main Warehouse",
      },
    }),
    prisma.hsnCode.create({
      data: {
        companyId: company.id,
        code: "8421",
        description: "Filtering machinery parts",
      },
    }),
    prisma.financialYear.create({
      data: {
        companyId: company.id,
        name: "FY-SALES",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        status: "OPEN",
      },
    }),
    prisma.numberSeries.create({
      data: {
        companyId: company.id,
        documentType: "SALES_INVOICE",
        prefix: "SI-T-",
        padding: 4,
        nextNumber: 1,
        resetPolicy: "NEVER",
      },
    }),
    prisma.numberSeries.create({
      data: {
        companyId: company.id,
        documentType: "JOURNAL_ENTRY",
        prefix: "JV-S-",
        padding: 4,
        nextNumber: 1,
        resetPolicy: "NEVER",
      },
    }),
    ...[
      ["1100", "Accounts Receivable", "ASSET"],
      ["1200", "Inventory", "ASSET"],
      ["2100", "GST Payable", "LIABILITY"],
      ["4000", "Sales Revenue", "INCOME"],
      ["5000", "Cost of Goods Sold", "EXPENSE"],
    ].map(([code, name, accountType]) =>
      prisma.account.create({
        data: {
          companyId: company.id,
          code,
          name,
          accountType: accountType as "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE",
        },
      }),
    ),
  ]);
  const taxRate = await prisma.taxRate.create({
    data: {
      companyId: company.id,
      name: "GST 18%",
      hsnCodeId: hsnCode.id,
      cgstRate: 9,
      sgstRate: 9,
      igstRate: 18,
      effectiveFrom: new Date("2026-04-01"),
    },
  });
  const product = await prisma.product.create({
    data: {
      companyId: company.id,
      code: "OIL-FILTER",
      name: "Oil Filter",
      categoryId: category.id,
      unitId: unit.id,
      hsnCodeId: hsnCode.id,
      taxRateId: taxRate.id,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      companyId: company.id,
      productId: product.id,
      code: "OIL-FILTER-STD",
      name: "Oil Filter Standard",
      salePrice: 350,
      purchasePrice: 220,
    },
  });
  await prisma.stockBalance.create({
    data: {
      companyId: company.id,
      productId: product.id,
      productVariantId: variant.id,
      warehouseId: warehouse.id,
      locationKey: `${warehouse.id}:-:-:-`,
      quantity: 10,
      averageCost: 220,
      stockValue: 2200,
    },
  });

  return {
    companyId: company.id,
    userId: user.id,
    customerId: customer.id,
    productId: product.id,
    productVariantId: variant.id,
    warehouseId: warehouse.id,
  };
}

test("sales invoice posting updates inventory, accounting, GST, ledger, audit log, and number series atomically", async () => {
  const fixture = await createSalesFixture();

  try {
    const invoice = await postSalesInvoice(
      {
        companyId: fixture.companyId,
        userId: fixture.userId,
        ipAddress: "127.0.0.1",
        userAgent: "integration-test",
      },
      {
        customerId: fixture.customerId,
        warehouseId: fixture.warehouseId,
        invoiceDate: "2026-07-31",
        taxMode: "CGST_SGST",
        narration: "Integration sales invoice",
        lines: [{ productVariantId: fixture.productVariantId, quantity: 2, unitPrice: 350 }],
      },
    );

    assert.equal(invoice.invoiceNumber, "SI-T-0001");
    assert.equal(invoice.status, "POSTED");
    assert.equal(invoice.taxableAmount.toString(), "700");
    assert.equal(invoice.cgstAmount.toString(), "63");
    assert.equal(invoice.sgstAmount.toString(), "63");
    assert.equal(invoice.grandTotal.toString(), "826");
    assert.equal(invoice.costOfGoodsSold.toString(), "440");

    const [balance, movements, journal, ledger, auditCount, invoiceSeries, journalSeries] = await Promise.all([
      prisma.stockBalance.findFirstOrThrow({ where: { companyId: fixture.companyId, productVariantId: fixture.productVariantId } }),
      prisma.stockMovement.findMany({ where: { companyId: fixture.companyId, documentType: "SALES_INVOICE" } }),
      prisma.journalEntry.findFirstOrThrow({
        where: { companyId: fixture.companyId, sourceType: "SALES_INVOICE" },
        include: { lines: true },
      }),
      prisma.partyLedgerEntry.findFirstOrThrow({ where: { companyId: fixture.companyId, documentType: "SALES_INVOICE" } }),
      prisma.auditLog.count({ where: { companyId: fixture.companyId, module: "sales", action: "POST" } }),
      prisma.numberSeries.findFirst({ where: { companyId: fixture.companyId, documentType: "SALES_INVOICE" } }),
      prisma.numberSeries.findFirst({ where: { companyId: fixture.companyId, documentType: "JOURNAL_ENTRY" } }),
    ]);

    assert.equal(balance.quantity.toString(), "8");
    assert.equal(balance.stockValue.toString(), "1760");
    assert.equal(movements.length, 1);
    assert.equal(movements[0]?.quantityOut.toString(), "2");
    assert.equal(journal.entryNumber, "JV-S-0001");
    assert.equal(journal.sourceId, invoice.id);
    assert.equal(journal.lines.length, 5);
    assert.equal(ledger.debitAmount.toString(), "826");
    assert.equal(auditCount, 1);
    assert.equal(invoiceSeries?.nextNumber, 2);
    assert.equal(journalSeries?.nextNumber, 2);
  } finally {
    await cleanupCompany(fixture.companyId);
  }
});

test("sales invoice posting rolls back when stock is insufficient", async () => {
  const fixture = await createSalesFixture();

  try {
    await assert.rejects(
      () =>
        postSalesInvoice(
          {
            companyId: fixture.companyId,
            userId: fixture.userId,
            ipAddress: "127.0.0.1",
            userAgent: "integration-test",
          },
          {
            customerId: fixture.customerId,
            warehouseId: fixture.warehouseId,
            invoiceDate: "2026-07-31",
            taxMode: "CGST_SGST",
            narration: "Insufficient stock invoice",
            lines: [{ productVariantId: fixture.productVariantId, quantity: 20, unitPrice: 350 }],
          },
        ),
      (error: unknown) => error instanceof ApiError && error.code === "INSUFFICIENT_STOCK",
    );

    const [balance, invoiceCount, movementCount, journalCount, ledgerCount, auditCount, invoiceSeries, journalSeries] = await Promise.all([
      prisma.stockBalance.findFirstOrThrow({ where: { companyId: fixture.companyId, productVariantId: fixture.productVariantId } }),
      prisma.salesInvoice.count({ where: { companyId: fixture.companyId } }),
      prisma.stockMovement.count({ where: { companyId: fixture.companyId } }),
      prisma.journalEntry.count({ where: { companyId: fixture.companyId } }),
      prisma.partyLedgerEntry.count({ where: { companyId: fixture.companyId } }),
      prisma.auditLog.count({ where: { companyId: fixture.companyId } }),
      prisma.numberSeries.findFirst({ where: { companyId: fixture.companyId, documentType: "SALES_INVOICE" } }),
      prisma.numberSeries.findFirst({ where: { companyId: fixture.companyId, documentType: "JOURNAL_ENTRY" } }),
    ]);

    assert.equal(balance.quantity.toString(), "10");
    assert.equal(balance.stockValue.toString(), "2200");
    assert.equal(invoiceCount, 0);
    assert.equal(movementCount, 0);
    assert.equal(journalCount, 0);
    assert.equal(ledgerCount, 0);
    assert.equal(auditCount, 0);
    assert.equal(invoiceSeries?.nextNumber, 1);
    assert.equal(journalSeries?.nextNumber, 1);
  } finally {
    await cleanupCompany(fixture.companyId);
  }
});
