import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import { cancelPurchaseInvoice, postPurchaseInvoice, postPurchaseReturn } from "./purchase.service";

type PurchaseFixture = {
  companyId: string;
  userId: string;
  supplierId: string;
  productVariantId: string;
  warehouseId: string;
};

async function cleanupCompany(companyId: string) {
  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.paymentAllocation.deleteMany({ where: { companyId } });
  await prisma.payment.deleteMany({ where: { companyId } });
  await prisma.paymentMode.deleteMany({ where: { companyId } });
  await prisma.partyLedgerEntry.deleteMany({ where: { companyId } });
  await prisma.purchaseReturnLine.deleteMany({ where: { companyId } });
  await prisma.purchaseReturn.deleteMany({ where: { companyId } });
  await prisma.purchaseInvoiceLine.deleteMany({ where: { companyId } });
  await prisma.purchaseInvoice.deleteMany({ where: { companyId } });
  await prisma.stockMovement.deleteMany({ where: { companyId } });
  await prisma.stockBalance.deleteMany({ where: { companyId } });
  await prisma.journalEntry.deleteMany({ where: { companyId } });
  await prisma.account.deleteMany({ where: { companyId } });
  await prisma.productVariant.deleteMany({ where: { companyId } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.taxRate.deleteMany({ where: { companyId } });
  await prisma.hsnCode.deleteMany({ where: { companyId } });
  await prisma.warehouse.deleteMany({ where: { companyId } });
  await prisma.supplier.deleteMany({ where: { companyId } });
  await prisma.category.deleteMany({ where: { companyId } });
  await prisma.unit.deleteMany({ where: { companyId } });
  await prisma.numberSeries.deleteMany({ where: { companyId } });
  await prisma.financialYear.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

async function createPurchaseFixture(financialYearStatus: "OPEN" | "CLOSED"): Promise<PurchaseFixture> {
  const suffix = Date.now().toString(36);
  const company = await prisma.company.create({
    data: {
      code: `PUR-${financialYearStatus}-${suffix}`,
      name: `Purchase Integration ${financialYearStatus} ${suffix}`,
    },
  });
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      username: `purchase-${financialYearStatus.toLowerCase()}-${suffix}`,
      email: `purchase-${financialYearStatus.toLowerCase()}-${suffix}@rams.test`,
      fullName: "Purchase Integration Tester",
      passwordHash: "not-used-in-integration-test",
    },
  });
  const [supplier, unit, category, warehouse, hsnCode] = await Promise.all([
    prisma.supplier.create({
      data: {
        companyId: company.id,
        code: "SUPP",
        name: "Parts Supplier",
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
        name: `FY-PUR-${financialYearStatus}`,
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        status: financialYearStatus,
      },
    }),
    prisma.numberSeries.create({
      data: {
        companyId: company.id,
        documentType: "PURCHASE_INVOICE",
        prefix: "PI-T-",
        padding: 4,
        nextNumber: 1,
        resetPolicy: "NEVER",
      },
    }),
    prisma.numberSeries.create({
      data: {
        companyId: company.id,
        documentType: "JOURNAL_ENTRY",
        prefix: "JV-P-",
        padding: 4,
        nextNumber: 1,
        resetPolicy: "NEVER",
      },
    }),
    prisma.numberSeries.create({
      data: {
        companyId: company.id,
        documentType: "PURCHASE_RETURN",
        prefix: "PR-T-",
        padding: 4,
        nextNumber: 1,
        resetPolicy: "NEVER",
      },
    }),
    ...[
      ["1200", "Inventory", "ASSET"],
      ["2000", "Accounts Payable", "LIABILITY"],
      ["2200", "GST Input", "ASSET"],
    ].map(([code, name, accountType]) =>
      prisma.account.create({
        data: {
          companyId: company.id,
          code,
          name,
          accountType: accountType as "ASSET" | "LIABILITY",
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

  return {
    companyId: company.id,
    userId: user.id,
    supplierId: supplier.id,
    productVariantId: variant.id,
    warehouseId: warehouse.id,
  };
}

function purchaseContext(fixture: PurchaseFixture) {
  return {
    companyId: fixture.companyId,
    userId: fixture.userId,
    ipAddress: "127.0.0.1",
    userAgent: "integration-test",
  };
}

async function postFixtureInvoice(fixture: PurchaseFixture, quantity = 3) {
  return postPurchaseInvoice(purchaseContext(fixture), {
    supplierId: fixture.supplierId,
    warehouseId: fixture.warehouseId,
    invoiceDate: "2026-07-31",
    taxMode: "CGST_SGST",
    supplierBillNumber: "SUP-BILL-RETURN-TEST",
    narration: "Purchase return integration invoice",
    lines: [{ productVariantId: fixture.productVariantId, quantity, unitCost: 220 }],
  });
}

test("purchase invoice posting updates inventory, accounting, GST input, supplier ledger, audit log, and number series atomically", async () => {
  const fixture = await createPurchaseFixture("OPEN");

  try {
    const invoice = await postPurchaseInvoice(
      {
        companyId: fixture.companyId,
        userId: fixture.userId,
        ipAddress: "127.0.0.1",
        userAgent: "integration-test",
      },
      {
        supplierId: fixture.supplierId,
        warehouseId: fixture.warehouseId,
        invoiceDate: "2026-07-31",
        taxMode: "CGST_SGST",
        supplierBillNumber: "SUP-BILL-001",
        narration: "Integration purchase invoice",
        lines: [{ productVariantId: fixture.productVariantId, quantity: 3, unitCost: 220 }],
      },
    );

    assert.equal(invoice.invoiceNumber, "PI-T-0001");
    assert.equal(invoice.status, "POSTED");
    assert.equal(invoice.taxableAmount.toString(), "660");
    assert.equal(invoice.cgstAmount.toString(), "59.4");
    assert.equal(invoice.sgstAmount.toString(), "59.4");
    assert.equal(invoice.grandTotal.toString(), "778.8");

    const [balance, movements, journal, ledger, auditCount, invoiceSeries, journalSeries] = await Promise.all([
      prisma.stockBalance.findFirstOrThrow({ where: { companyId: fixture.companyId, productVariantId: fixture.productVariantId } }),
      prisma.stockMovement.findMany({ where: { companyId: fixture.companyId, documentType: "PURCHASE_INVOICE" } }),
      prisma.journalEntry.findFirstOrThrow({
        where: { companyId: fixture.companyId, sourceType: "PURCHASE_INVOICE" },
        include: { lines: true },
      }),
      prisma.partyLedgerEntry.findFirstOrThrow({ where: { companyId: fixture.companyId, documentType: "PURCHASE_INVOICE" } }),
      prisma.auditLog.count({ where: { companyId: fixture.companyId, module: "purchase", action: "POST" } }),
      prisma.numberSeries.findFirst({ where: { companyId: fixture.companyId, documentType: "PURCHASE_INVOICE" } }),
      prisma.numberSeries.findFirst({ where: { companyId: fixture.companyId, documentType: "JOURNAL_ENTRY" } }),
    ]);

    assert.equal(balance.quantity.toString(), "3");
    assert.equal(balance.stockValue.toString(), "660");
    assert.equal(balance.averageCost.toString(), "220");
    assert.equal(movements.length, 1);
    assert.equal(movements[0]?.quantityIn.toString(), "3");
    assert.equal(journal.entryNumber, "JV-P-0001");
    assert.equal(journal.sourceId, invoice.id);
    assert.equal(journal.lines.length, 3);
    assert.equal(ledger.creditAmount.toString(), "778.8");
    assert.equal(auditCount, 1);
    assert.equal(invoiceSeries?.nextNumber, 2);
    assert.equal(journalSeries?.nextNumber, 2);
  } finally {
    await cleanupCompany(fixture.companyId);
  }
});

test("purchase invoice posting rolls back when posting date is outside an open financial year", async () => {
  const fixture = await createPurchaseFixture("CLOSED");

  try {
    await assert.rejects(
      () =>
        postPurchaseInvoice(
          {
            companyId: fixture.companyId,
            userId: fixture.userId,
            ipAddress: "127.0.0.1",
            userAgent: "integration-test",
          },
          {
            supplierId: fixture.supplierId,
            warehouseId: fixture.warehouseId,
            invoiceDate: "2026-07-31",
            taxMode: "CGST_SGST",
            narration: "Closed year purchase invoice",
            lines: [{ productVariantId: fixture.productVariantId, quantity: 3, unitCost: 220 }],
          },
        ),
      (error: unknown) => error instanceof ApiError && error.code === "FINANCIAL_YEAR_NOT_OPEN",
    );

    const [invoiceCount, balanceCount, movementCount, journalCount, ledgerCount, auditCount, invoiceSeries, journalSeries] = await Promise.all([
      prisma.purchaseInvoice.count({ where: { companyId: fixture.companyId } }),
      prisma.stockBalance.count({ where: { companyId: fixture.companyId } }),
      prisma.stockMovement.count({ where: { companyId: fixture.companyId } }),
      prisma.journalEntry.count({ where: { companyId: fixture.companyId } }),
      prisma.partyLedgerEntry.count({ where: { companyId: fixture.companyId } }),
      prisma.auditLog.count({ where: { companyId: fixture.companyId } }),
      prisma.numberSeries.findFirst({ where: { companyId: fixture.companyId, documentType: "PURCHASE_INVOICE" } }),
      prisma.numberSeries.findFirst({ where: { companyId: fixture.companyId, documentType: "JOURNAL_ENTRY" } }),
    ]);

    assert.equal(invoiceCount, 0);
    assert.equal(balanceCount, 0);
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
