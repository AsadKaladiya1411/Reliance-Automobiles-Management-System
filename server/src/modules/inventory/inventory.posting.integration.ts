import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import { postOpeningStock } from "./inventory.service";

type InventoryFixture = {
  companyId: string;
  userId: string;
  productVariantId: string;
  warehouseId: string;
};

async function cleanupCompany(companyId: string) {
  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.stockMovement.deleteMany({ where: { companyId } });
  await prisma.stockBalance.deleteMany({ where: { companyId } });
  await prisma.productVariant.deleteMany({ where: { companyId } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.warehouse.deleteMany({ where: { companyId } });
  await prisma.category.deleteMany({ where: { companyId } });
  await prisma.unit.deleteMany({ where: { companyId } });
  await prisma.numberSeries.deleteMany({ where: { companyId } });
  await prisma.financialYear.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

async function createInventoryFixture(financialYearStatus: "OPEN" | "CLOSED"): Promise<InventoryFixture> {
  const suffix = Date.now().toString(36);
  const company = await prisma.company.create({
    data: {
      code: `INV-${financialYearStatus}-${suffix}`,
      name: `Inventory Integration ${financialYearStatus} ${suffix}`,
    },
  });
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      username: `inventory-${financialYearStatus.toLowerCase()}-${suffix}`,
      email: `inventory-${financialYearStatus.toLowerCase()}-${suffix}@rams.test`,
      fullName: "Inventory Integration Tester",
      passwordHash: "not-used-in-integration-test",
    },
  });
  const [unit, category, warehouse] = await Promise.all([
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
    prisma.financialYear.create({
      data: {
        companyId: company.id,
        name: `FY-${financialYearStatus}`,
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        status: financialYearStatus,
      },
    }),
    prisma.numberSeries.create({
      data: {
        companyId: company.id,
        documentType: "OPENING_STOCK",
        prefix: "OS-T-",
        padding: 4,
        nextNumber: 1,
        resetPolicy: "NEVER",
      },
    }),
  ]);
  const product = await prisma.product.create({
    data: {
      companyId: company.id,
      code: "OIL-FILTER",
      name: "Oil Filter",
      categoryId: category.id,
      unitId: unit.id,
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
    productVariantId: variant.id,
    warehouseId: warehouse.id,
  };
}

test("opening stock posting creates stock balance, movement, audit log, and advances number series", async () => {
  const fixture = await createInventoryFixture("OPEN");

  try {
    const result = await postOpeningStock(
      {
        companyId: fixture.companyId,
        userId: fixture.userId,
        ipAddress: "127.0.0.1",
        userAgent: "integration-test",
      },
      {
        productVariantId: fixture.productVariantId,
        warehouseId: fixture.warehouseId,
        quantity: 10,
        unitCost: 220,
        documentDate: "2026-07-31",
        narration: "Integration opening stock",
      },
    );

    assert.equal(result.documentNumber, "OS-T-0001");
    assert.equal(result.movement.movementType, "OPENING_STOCK");
    assert.equal(result.movement.quantityIn.toString(), "10");
    assert.equal(result.balance.quantity.toString(), "10");
    assert.equal(result.balance.averageCost.toString(), "220");

    const [balanceCount, movementCount, auditCount, series] = await Promise.all([
      prisma.stockBalance.count({ where: { companyId: fixture.companyId } }),
      prisma.stockMovement.count({ where: { companyId: fixture.companyId } }),
      prisma.auditLog.count({ where: { companyId: fixture.companyId, module: "inventory", action: "POST" } }),
      prisma.numberSeries.findFirst({ where: { companyId: fixture.companyId, documentType: "OPENING_STOCK" } }),
    ]);

    assert.equal(balanceCount, 1);
    assert.equal(movementCount, 1);
    assert.equal(auditCount, 1);
    assert.equal(series?.nextNumber, 2);
  } finally {
    await cleanupCompany(fixture.companyId);
  }
});

test("opening stock posting rolls back when posting date is outside an open financial year", async () => {
  const fixture = await createInventoryFixture("CLOSED");

  try {
    await assert.rejects(
      () =>
        postOpeningStock(
          {
            companyId: fixture.companyId,
            userId: fixture.userId,
            ipAddress: "127.0.0.1",
            userAgent: "integration-test",
          },
          {
            productVariantId: fixture.productVariantId,
            warehouseId: fixture.warehouseId,
            quantity: 10,
            unitCost: 220,
            documentDate: "2026-07-31",
            narration: "Closed year opening stock",
          },
        ),
      (error: unknown) => error instanceof ApiError && error.code === "FINANCIAL_YEAR_NOT_OPEN",
    );

    const [balanceCount, movementCount, auditCount, series] = await Promise.all([
      prisma.stockBalance.count({ where: { companyId: fixture.companyId } }),
      prisma.stockMovement.count({ where: { companyId: fixture.companyId } }),
      prisma.auditLog.count({ where: { companyId: fixture.companyId } }),
      prisma.numberSeries.findFirst({ where: { companyId: fixture.companyId, documentType: "OPENING_STOCK" } }),
    ]);

    assert.equal(balanceCount, 0);
    assert.equal(movementCount, 0);
    assert.equal(auditCount, 0);
    assert.equal(series?.nextNumber, 1);
  } finally {
    await cleanupCompany(fixture.companyId);
  }
});
