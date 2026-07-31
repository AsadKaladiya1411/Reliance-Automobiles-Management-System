import { Prisma } from "../../generated/prisma/client";
import prisma from "../../lib/prisma";
import type { RequestContext } from "../../types/request-context";
import { ApiError } from "../../utils/api-error";
import { approvalStatusForDocument, createApprovalRequestForDocument } from "../approvals/approvals.service";
import { requireOpenFinancialYear } from "../financial-year/fiscal-period.service";
import { formatDocumentNumber } from "../number-series/number-series.service";

type SalesContext = RequestContext & {
  companyId: string;
  userId: string;
};

type SalesLineInput = {
  productVariantId?: unknown;
  blockId?: unknown;
  rackId?: unknown;
  shelfId?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  discountAmount?: unknown;
  discountPercent?: unknown;
};

type ReturnLineInput = {
  salesInvoiceLineId?: unknown;
  quantity?: unknown;
};

type ChallanLineInput = {
  productVariantId?: unknown;
  quantity?: unknown;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_SALES_INPUT", `${field} is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function positiveDecimal(value: unknown, field: string, scale = 2) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new ApiError(400, "INVALID_SALES_NUMBER", `${field} must be greater than zero.`);
  }

  return new Prisma.Decimal(number.toFixed(scale));
}

function nonNegativeDecimal(value: unknown, field: string, scale = 2) {
  if (value === undefined || value === null || value === "") {
    return new Prisma.Decimal(0);
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new ApiError(400, "INVALID_SALES_NUMBER", `${field} cannot be negative.`);
  }

  return new Prisma.Decimal(number.toFixed(scale));
}

function calculateDiscount(line: SalesLineInput, grossAmount: Prisma.Decimal) {
  const hasDiscountAmount = line.discountAmount !== undefined && line.discountAmount !== null && line.discountAmount !== "";
  const hasDiscountPercent = line.discountPercent !== undefined && line.discountPercent !== null && line.discountPercent !== "";

  if (hasDiscountAmount && hasDiscountPercent) {
    throw new ApiError(400, "DISCOUNT_INPUT_CONFLICT", "Use either discount amount or discount percent, not both.");
  }

  const discountAmount = hasDiscountPercent
    ? grossAmount.mul(nonNegativeDecimal(line.discountPercent, "Discount percent", 2)).div(100).toDecimalPlaces(2)
    : nonNegativeDecimal(line.discountAmount, "Discount amount", 2);

  if (discountAmount.gte(grossAmount)) {
    throw new ApiError(400, "DISCOUNT_EXCEEDS_LINE_AMOUNT", "Discount must be less than the line gross amount.");
  }

  return discountAmount;
}

function unitPriceOrDefault(line: SalesLineInput, defaultPrice: Prisma.Decimal) {
  const rawPrice = line.unitPrice;

  if (rawPrice === undefined || rawPrice === null || rawPrice === "") {
    if (defaultPrice.lte(0)) {
      throw new ApiError(400, "SALE_PRICE_REQUIRED", "Unit price is required because the product variant has no default sale price.");
    }
    return defaultPrice.toDecimalPlaces(2);
  }

  const number = Number(rawPrice);

  if (!Number.isFinite(number) || number < 0) {
    throw new ApiError(400, "INVALID_SALES_NUMBER", "Unit price cannot be negative.");
  }

  if (number === 0) {
    if (defaultPrice.lte(0)) {
      throw new ApiError(400, "SALE_PRICE_REQUIRED", "Unit price is required because the product variant has no default sale price.");
    }
    return defaultPrice.toDecimalPlaces(2);
  }

  return new Prisma.Decimal(number.toFixed(2));
}

function parseDate(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "INVALID_DATE", "Invoice date is invalid.");
  }

  return date;
}

function locationKey(input: { warehouseId: string; blockId?: string; rackId?: string; shelfId?: string }) {
  return [input.warehouseId, input.blockId ?? "-", input.rackId ?? "-", input.shelfId ?? "-"].join(":");
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function addQuantity(map: Map<string, Prisma.Decimal>, productVariantId: string, quantity: Prisma.Decimal) {
  map.set(productVariantId, (map.get(productVariantId) ?? new Prisma.Decimal(0)).plus(quantity));
}

function sumQuantities(lines: Array<{ quantity: Prisma.Decimal | number | string }>) {
  return lines.reduce((total, line) => total.plus(line.quantity), new Prisma.Decimal(0));
}

function quantityStatus(done: Prisma.Decimal, expected: Prisma.Decimal, none: string, partial: string, complete: string) {
  if (expected.lte(0) || done.lte(0)) {
    return none;
  }

  return done.gte(expected) ? complete : partial;
}

async function getCustomerLedgerPosition(tx: Prisma.TransactionClient, companyId: string, customerId: string) {
  const ledgerTotals = await tx.partyLedgerEntry.aggregate({
    where: { companyId, partyType: "CUSTOMER", customerId },
    _sum: { debitAmount: true, creditAmount: true },
  });
  const debit = new Prisma.Decimal(ledgerTotals._sum.debitAmount ?? 0);
  const credit = new Prisma.Decimal(ledgerTotals._sum.creditAmount ?? 0);
  const outstanding = debit.minus(credit).toDecimalPlaces(2);
  const oldestOpenDebit = outstanding.gt(0)
    ? await tx.partyLedgerEntry.findFirst({
        where: { companyId, partyType: "CUSTOMER", customerId, debitAmount: { gt: 0 } },
        orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
      })
    : null;

  return { outstanding, oldestOpenDebit };
}

async function nextDocumentNumber(tx: Prisma.TransactionClient, companyId: string, documentType: string) {
  const series = await tx.numberSeries.findFirst({
    where: { companyId, documentType, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });

  if (!series) {
    throw new ApiError(400, "NUMBER_SERIES_MISSING", `Create a ${documentType} number series before posting.`);
  }

  await tx.numberSeries.update({ where: { id: series.id }, data: { nextNumber: { increment: 1 } } });
  return formatDocumentNumber(series);
}

async function requireAccount(tx: Prisma.TransactionClient, companyId: string, code: string) {
  const account = await tx.account.findFirst({ where: { companyId, code, status: "ACTIVE" } });

  if (!account) {
    throw new ApiError(400, "ACCOUNT_MISSING", `Required account ${code} is missing. Seed default accounts first.`);
  }

  return account;
}

async function validateLineLocation(
  tx: Prisma.TransactionClient,
  companyId: string,
  warehouseId: string,
  input: Pick<SalesLineInput, "blockId" | "rackId" | "shelfId">,
) {
  const blockId = optionalString(input.blockId);
  const rackId = optionalString(input.rackId);
  const shelfId = optionalString(input.shelfId);

  if (blockId) {
    const block = await tx.warehouseBlock.findFirst({ where: { id: blockId, warehouseId, status: "ACTIVE" } });
    if (!block) {
      throw new ApiError(404, "WAREHOUSE_BLOCK_NOT_FOUND", "Warehouse block not found or inactive.");
    }
  }

  if (rackId) {
    const rack = await tx.warehouseRack.findFirst({
      where: { id: rackId, status: "ACTIVE", block: { warehouseId, warehouse: { companyId } } },
    });
    if (!rack) {
      throw new ApiError(404, "WAREHOUSE_RACK_NOT_FOUND", "Warehouse rack not found or inactive.");
    }
  }

  if (shelfId) {
    const shelf = await tx.warehouseShelf.findFirst({
      where: { id: shelfId, status: "ACTIVE", rack: { block: { warehouseId, warehouse: { companyId } } } },
    });
    if (!shelf) {
      throw new ApiError(404, "WAREHOUSE_SHELF_NOT_FOUND", "Warehouse shelf not found or inactive.");
    }
  }

  return { blockId, rackId, shelfId };
}

export async function getSalesSummary(companyId: string) {
  const [approvedQuotations, approvedOrders, approvedChallans, postedInvoices, postedReturns, invoiceTotals, returnTotals] = await Promise.all([
    prisma.salesQuotation.count({ where: { companyId, status: "APPROVED" } }),
    prisma.salesOrder.count({ where: { companyId, status: "APPROVED" } }),
    prisma.deliveryChallan.count({ where: { companyId, status: "APPROVED" } }),
    prisma.salesInvoice.count({ where: { companyId, status: "POSTED" } }),
    prisma.salesReturn.count({ where: { companyId } }),
    prisma.salesInvoice.aggregate({
      where: { companyId, status: "POSTED" },
      _sum: { taxableAmount: true, totalTaxAmount: true, grandTotal: true, costOfGoodsSold: true },
    }),
    prisma.salesReturn.aggregate({
      where: { companyId },
      _sum: { taxableAmount: true, totalTaxAmount: true, grandTotal: true, costOfGoodsSold: true },
    }),
  ]);
  const grossTaxableAmount = new Prisma.Decimal(invoiceTotals._sum.taxableAmount ?? 0);
  const grossTaxAmount = new Prisma.Decimal(invoiceTotals._sum.totalTaxAmount ?? 0);
  const grossGrandTotal = new Prisma.Decimal(invoiceTotals._sum.grandTotal ?? 0);
  const grossCostOfGoodsSold = new Prisma.Decimal(invoiceTotals._sum.costOfGoodsSold ?? 0);
  const returnTaxableAmount = new Prisma.Decimal(returnTotals._sum.taxableAmount ?? 0);
  const returnTaxAmount = new Prisma.Decimal(returnTotals._sum.totalTaxAmount ?? 0);
  const returnGrandTotal = new Prisma.Decimal(returnTotals._sum.grandTotal ?? 0);
  const returnCostOfGoodsSold = new Prisma.Decimal(returnTotals._sum.costOfGoodsSold ?? 0);

  return {
    approvedQuotations,
    approvedOrders,
    approvedChallans,
    postedInvoices,
    postedReturns,
    grossTaxableAmount,
    grossTaxAmount,
    grossGrandTotal,
    grossCostOfGoodsSold,
    returnTaxableAmount,
    returnTaxAmount,
    returnGrandTotal,
    returnCostOfGoodsSold,
    taxableAmount: grossTaxableAmount.minus(returnTaxableAmount),
    totalTaxAmount: grossTaxAmount.minus(returnTaxAmount),
    grandTotal: grossGrandTotal.minus(returnGrandTotal),
    costOfGoodsSold: grossCostOfGoodsSold.minus(returnCostOfGoodsSold),
  };
}

export async function listSalesQuotations(companyId: string) {
  return prisma.salesQuotation.findMany({
    where: { companyId },
    include: {
      customer: true,
      lines: { include: { productVariant: true }, orderBy: { lineOrder: "asc" } },
    },
    orderBy: [{ quotationDate: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
}

export async function listSalesOrders(companyId: string) {
  const orders = await prisma.salesOrder.findMany({
    where: { companyId },
    include: {
      customer: true,
      quotation: true,
      lines: { include: { productVariant: true }, orderBy: { lineOrder: "asc" } },
    },
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  const orderIds = orders.map((order) => order.id);
  const delivered = orderIds.length
    ? await prisma.deliveryChallanLine.groupBy({
        by: ["deliveryChallanId"],
        where: { companyId, deliveryChallan: { salesOrderId: { in: orderIds }, status: "APPROVED" } },
        _sum: { quantity: true },
      })
    : [];
  const challans = orderIds.length
    ? await prisma.deliveryChallan.findMany({
        where: { companyId, salesOrderId: { in: orderIds }, status: "APPROVED" },
        select: { id: true, salesOrderId: true },
      })
    : [];
  const challanToOrder = new Map(challans.map((challan) => [challan.id, challan.salesOrderId]));
  const deliveredByOrder = new Map<string, Prisma.Decimal>();

  for (const row of delivered) {
    const salesOrderId = challanToOrder.get(row.deliveryChallanId);
    if (salesOrderId) {
      deliveredByOrder.set(salesOrderId, (deliveredByOrder.get(salesOrderId) ?? new Prisma.Decimal(0)).plus(row._sum.quantity ?? 0));
    }
  }

  return orders.map((order) => {
    const orderedQuantity = sumQuantities(order.lines);
    const deliveredQuantity = deliveredByOrder.get(order.id) ?? new Prisma.Decimal(0);

    return {
      ...order,
      orderedQuantity,
      deliveredQuantity,
      deliveryStatus: quantityStatus(deliveredQuantity, orderedQuantity, "NOT_DELIVERED", "PARTIALLY_DELIVERED", "DELIVERED"),
    };
  });
}

export async function listDeliveryChallans(companyId: string) {
  const challans = await prisma.deliveryChallan.findMany({
    where: { companyId },
    include: {
      customer: true,
      warehouse: true,
      salesOrder: true,
      lines: { include: { productVariant: true }, orderBy: { lineOrder: "asc" } },
    },
    orderBy: [{ challanDate: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  const challanIds = challans.map((challan) => challan.id);
  const invoiced = challanIds.length
    ? await prisma.salesInvoiceLine.groupBy({
        by: ["salesInvoiceId"],
        where: { companyId, salesInvoice: { deliveryChallanId: { in: challanIds }, status: "POSTED" } },
        _sum: { quantity: true },
      })
    : [];
  const invoices = challanIds.length
    ? await prisma.salesInvoice.findMany({
        where: { companyId, deliveryChallanId: { in: challanIds }, status: "POSTED" },
        select: { id: true, deliveryChallanId: true },
      })
    : [];
  const invoiceToChallan = new Map(invoices.map((invoice) => [invoice.id, invoice.deliveryChallanId]));
  const invoicedByChallan = new Map<string, Prisma.Decimal>();

  for (const row of invoiced) {
    const deliveryChallanId = invoiceToChallan.get(row.salesInvoiceId);
    if (deliveryChallanId) {
      invoicedByChallan.set(
        deliveryChallanId,
        (invoicedByChallan.get(deliveryChallanId) ?? new Prisma.Decimal(0)).plus(row._sum.quantity ?? 0),
      );
    }
  }

  return challans.map((challan) => {
    const deliveredQuantity = sumQuantities(challan.lines);
    const invoicedQuantity = invoicedByChallan.get(challan.id) ?? new Prisma.Decimal(0);

    return {
      ...challan,
      deliveredQuantity,
      invoicedQuantity,
      invoiceStatus: quantityStatus(invoicedQuantity, deliveredQuantity, "NOT_INVOICED", "PARTIALLY_INVOICED", "INVOICED"),
    };
  });
}

export async function listSalesInvoices(companyId: string) {
  return prisma.salesInvoice.findMany({
    where: { companyId },
    include: {
      customer: true,
      warehouse: true,
      salesOrder: true,
      deliveryChallan: true,
      lines: { include: { product: true, productVariant: true }, orderBy: { lineOrder: "asc" } },
    },
    orderBy: { invoiceDate: "desc" },
    take: 50,
  });
}

async function preparePlanningLines(tx: Prisma.TransactionClient, companyId: string, rawLines: SalesLineInput[]) {
  const preparedLines = [];

  for (const [index, line] of rawLines.entries()) {
    const productVariantId = requiredString(line.productVariantId, "Product variant");
    const variant = await tx.productVariant.findFirst({
      where: { id: productVariantId, companyId, status: "ACTIVE", product: { status: "ACTIVE" } },
      include: { product: { include: { taxRate: true } } },
    });

    if (!variant) {
      throw new ApiError(404, "PRODUCT_VARIANT_NOT_FOUND", "Product variant not found or inactive.");
    }

    const quantity = positiveDecimal(line.quantity, "Quantity", 3);
    const unitPrice = unitPriceOrDefault(line, new Prisma.Decimal(variant.salePrice ?? 0));
    const grossAmount = quantity.mul(unitPrice).toDecimalPlaces(2);
    const discountAmount = calculateDiscount(line, grossAmount);
    const taxableAmount = grossAmount.minus(discountAmount).toDecimalPlaces(2);
    const taxAmount = taxableAmount.mul(variant.product.taxRate?.igstRate ?? new Prisma.Decimal(0)).div(100).toDecimalPlaces(2);

    preparedLines.push({
      companyId,
      productVariantId,
      quantity,
      unitPrice,
      discountAmount,
      taxableAmount,
      taxAmount,
      lineTotal: taxableAmount.plus(taxAmount).toDecimalPlaces(2),
      lineOrder: index + 1,
    });
  }

  return preparedLines;
}

export async function createSalesQuotation(context: SalesContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const customerId = requiredString(data.customerId, "Customer");
  const quotationDate = parseDate(data.quotationDate);
  const validUntil = optionalString(data.validUntil) ? parseDate(data.validUntil) : undefined;
  const rawLines = Array.isArray(data.lines) ? (data.lines as SalesLineInput[]) : [];

  if (rawLines.length === 0) {
    throw new ApiError(400, "SALES_QUOTATION_LINES_REQUIRED", "At least one quotation line is required.");
  }

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, companyId: context.companyId, status: "ACTIVE" },
    });

    if (!customer) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found or inactive.");
    }

    const quotationNumber = await nextDocumentNumber(tx, context.companyId, "SALES_QUOTATION");
    const preparedLines = await preparePlanningLines(tx, context.companyId, rawLines);
    const taxableAmount = preparedLines.reduce((total, line) => total.plus(line.taxableAmount), new Prisma.Decimal(0));
    const totalTaxAmount = preparedLines.reduce((total, line) => total.plus(line.taxAmount), new Prisma.Decimal(0));
    const grandTotal = taxableAmount.plus(totalTaxAmount).toDecimalPlaces(2);
    const status = await approvalStatusForDocument(tx, {
      companyId: context.companyId,
      module: "sales",
      documentType: "SALES_QUOTATION",
      amount: grandTotal,
    });
    const quotation = await tx.salesQuotation.create({
      data: {
        companyId: context.companyId,
        customerId,
        quotationNumber,
        quotationDate,
        validUntil,
        taxableAmount,
        totalTaxAmount,
        grandTotal,
        status,
        narration: optionalString(data.narration),
        createdByUserId: context.userId,
        lines: { create: preparedLines },
      },
      include: { customer: true, lines: { include: { productVariant: true } } },
    });

    if (status === "PENDING_APPROVAL") {
      await createApprovalRequestForDocument(tx, context, {
        module: "sales",
        documentType: "SALES_QUOTATION",
        documentId: quotation.id,
        documentNumber: quotation.quotationNumber,
        amount: grandTotal,
        reason: "Sales quotation requires approval before order conversion.",
      });
    }

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "sales",
        action: "CREATE",
        entityType: "SalesQuotation",
        entityId: quotation.id,
        description: status === "PENDING_APPROVAL" ? "Sales quotation created pending approval." : "Sales quotation created.",
        afterData: json(quotation),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return quotation;
  });
}

export async function createSalesOrder(context: SalesContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const customerId = requiredString(data.customerId, "Customer");
  const quotationId = optionalString(data.quotationId);
  const orderDate = parseDate(data.orderDate);
  const expectedDate = optionalString(data.expectedDate) ? parseDate(data.expectedDate) : undefined;
  const rawLines = Array.isArray(data.lines) ? (data.lines as SalesLineInput[]) : [];

  if (rawLines.length === 0) {
    throw new ApiError(400, "SALES_ORDER_LINES_REQUIRED", "At least one sales order line is required.");
  }

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, companyId: context.companyId, status: "ACTIVE" },
    });

    if (!customer) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found or inactive.");
    }

    if (quotationId) {
      const quotation = await tx.salesQuotation.findFirst({
        where: { id: quotationId, companyId: context.companyId, customerId, status: "APPROVED" },
      });
      if (!quotation) {
        throw new ApiError(404, "SALES_QUOTATION_NOT_FOUND", "Approved quotation not found for this customer.");
      }
    }

    const orderNumber = await nextDocumentNumber(tx, context.companyId, "SALES_ORDER");
    const preparedLines = await preparePlanningLines(tx, context.companyId, rawLines);
    const taxableAmount = preparedLines.reduce((total, line) => total.plus(line.taxableAmount), new Prisma.Decimal(0));
    const totalTaxAmount = preparedLines.reduce((total, line) => total.plus(line.taxAmount), new Prisma.Decimal(0));
    const grandTotal = taxableAmount.plus(totalTaxAmount).toDecimalPlaces(2);
    const status = await approvalStatusForDocument(tx, {
      companyId: context.companyId,
      module: "sales",
      documentType: "SALES_ORDER",
      amount: grandTotal,
    });
    const order = await tx.salesOrder.create({
      data: {
        companyId: context.companyId,
        customerId,
        quotationId,
        orderNumber,
        orderDate,
        expectedDate,
        taxableAmount,
        totalTaxAmount,
        grandTotal,
        status,
        narration: optionalString(data.narration),
        createdByUserId: context.userId,
        lines: { create: preparedLines },
      },
      include: { customer: true, quotation: true, lines: { include: { productVariant: true } } },
    });

    if (status === "PENDING_APPROVAL") {
      await createApprovalRequestForDocument(tx, context, {
        module: "sales",
        documentType: "SALES_ORDER",
        documentId: order.id,
        documentNumber: order.orderNumber,
        amount: grandTotal,
        reason: "Sales order requires approval before delivery or invoice conversion.",
      });
    }

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "sales",
        action: "CREATE",
        entityType: "SalesOrder",
        entityId: order.id,
        description: status === "PENDING_APPROVAL" ? "Sales order created pending approval." : "Sales order created.",
        afterData: json(order),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return order;
  });
}

export async function createDeliveryChallan(context: SalesContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const customerId = requiredString(data.customerId, "Customer");
  const warehouseId = requiredString(data.warehouseId, "Warehouse");
  const salesOrderId = optionalString(data.salesOrderId);
  const challanDate = parseDate(data.challanDate);
  const rawLines = Array.isArray(data.lines) ? (data.lines as ChallanLineInput[]) : [];

  if (rawLines.length === 0) {
    throw new ApiError(400, "DELIVERY_CHALLAN_LINES_REQUIRED", "At least one delivery challan line is required.");
  }

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, companyId: context.companyId, status: "ACTIVE" },
    });
    const warehouse = await tx.warehouse.findFirst({
      where: { id: warehouseId, companyId: context.companyId, status: "ACTIVE" },
    });

    if (!customer) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found or inactive.");
    }
    if (!warehouse) {
      throw new ApiError(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found or inactive.");
    }

    if (salesOrderId) {
      const salesOrder = await tx.salesOrder.findFirst({
        where: { id: salesOrderId, companyId: context.companyId, customerId, status: "APPROVED" },
      });
      if (!salesOrder) {
        throw new ApiError(404, "SALES_ORDER_NOT_FOUND", "Approved sales order not found for this customer.");
      }
    }

    const challanNumber = await nextDocumentNumber(tx, context.companyId, "DELIVERY_CHALLAN");
    const status = await approvalStatusForDocument(tx, {
      companyId: context.companyId,
      module: "sales",
      documentType: "DELIVERY_CHALLAN",
    });
    const preparedLines = [];

    for (const [index, line] of rawLines.entries()) {
      const productVariantId = requiredString(line.productVariantId, "Product variant");
      const variant = await tx.productVariant.findFirst({
        where: { id: productVariantId, companyId: context.companyId, status: "ACTIVE", product: { status: "ACTIVE" } },
      });

      if (!variant) {
        throw new ApiError(404, "PRODUCT_VARIANT_NOT_FOUND", "Product variant not found or inactive.");
      }

      preparedLines.push({
        companyId: context.companyId,
        productVariantId,
        quantity: positiveDecimal(line.quantity, "Quantity", 3),
        lineOrder: index + 1,
      });
    }

    const challan = await tx.deliveryChallan.create({
      data: {
        companyId: context.companyId,
        customerId,
        warehouseId,
        salesOrderId,
        challanNumber,
        challanDate,
        status,
        narration: optionalString(data.narration),
        createdByUserId: context.userId,
        lines: { create: preparedLines },
      },
      include: { customer: true, warehouse: true, salesOrder: true, lines: { include: { productVariant: true } } },
    });

    if (status === "PENDING_APPROVAL") {
      await createApprovalRequestForDocument(tx, context, {
        module: "sales",
        documentType: "DELIVERY_CHALLAN",
        documentId: challan.id,
        documentNumber: challan.challanNumber,
        reason: "Delivery challan requires approval before invoice conversion.",
      });
    }

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "sales",
        action: "CREATE",
        entityType: "DeliveryChallan",
        entityId: challan.id,
        description: status === "PENDING_APPROVAL" ? "Delivery challan created pending approval without stock impact." : "Delivery challan created without stock impact.",
        afterData: json(challan),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return challan;
  });
}

export async function listSalesReturns(companyId: string) {
  return prisma.salesReturn.findMany({
    where: { companyId },
    include: {
      customer: true,
      warehouse: true,
      salesInvoice: true,
      lines: { include: { product: true, productVariant: true }, orderBy: { lineOrder: "asc" } },
    },
    orderBy: { returnDate: "desc" },
    take: 50,
  });
}

export async function postSalesInvoice(context: SalesContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const customerId = requiredString(data.customerId, "Customer");
  const warehouseId = requiredString(data.warehouseId, "Warehouse");
  const salesOrderId = optionalString(data.salesOrderId);
  const deliveryChallanId = optionalString(data.deliveryChallanId);
  const invoiceDate = parseDate(data.invoiceDate);
  const taxMode = (optionalString(data.taxMode) ?? "CGST_SGST").toUpperCase();
  const rawLines = Array.isArray(data.lines) ? (data.lines as SalesLineInput[]) : [];

  if (!["CGST_SGST", "IGST"].includes(taxMode)) {
    throw new ApiError(400, "INVALID_TAX_MODE", "Tax mode must be CGST_SGST or IGST.");
  }

  if (rawLines.length === 0) {
    throw new ApiError(400, "SALES_LINES_REQUIRED", "At least one sales invoice line is required.");
  }

  return prisma.$transaction(async (tx) => {
    await requireOpenFinancialYear(tx, context.companyId, invoiceDate);

    const customer = await tx.customer.findFirst({
      where: { id: customerId, companyId: context.companyId, status: "ACTIVE" },
    });
    const warehouse = await tx.warehouse.findFirst({
      where: { id: warehouseId, companyId: context.companyId, status: "ACTIVE" },
    });

    if (!customer) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found or inactive.");
    }
    if (!warehouse) {
      throw new ApiError(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found or inactive.");
    }

    let sourceOrder: Prisma.SalesOrderGetPayload<{ include: { lines: true } }> | null = null;
    let sourceChallan: Prisma.DeliveryChallanGetPayload<{ include: { lines: true } }> | null = null;

    if (salesOrderId) {
      const salesOrder = await tx.salesOrder.findFirst({
        where: { id: salesOrderId, companyId: context.companyId, customerId, status: "APPROVED" },
        include: { lines: true },
      });

      if (!salesOrder) {
        throw new ApiError(404, "SALES_ORDER_NOT_FOUND", "Approved sales order not found for this customer.");
      }

      sourceOrder = salesOrder;
    }

    if (deliveryChallanId) {
      const deliveryChallan = await tx.deliveryChallan.findFirst({
        where: { id: deliveryChallanId, companyId: context.companyId, customerId, warehouseId, status: "APPROVED" },
        include: { lines: true },
      });

      if (!deliveryChallan) {
        throw new ApiError(404, "DELIVERY_CHALLAN_NOT_FOUND", "Approved delivery challan not found for this customer and warehouse.");
      }

      if (salesOrderId && deliveryChallan.salesOrderId && deliveryChallan.salesOrderId !== salesOrderId) {
        throw new ApiError(400, "SOURCE_DOCUMENT_MISMATCH", "Delivery challan does not belong to the selected sales order.");
      }

      sourceChallan = deliveryChallan;
    }

    const receivableAccount = await requireAccount(tx, context.companyId, "1100");
    const revenueAccount = await requireAccount(tx, context.companyId, "4000");
    const gstPayableAccount = await requireAccount(tx, context.companyId, "2100");
    const cogsAccount = await requireAccount(tx, context.companyId, "5000");
    const inventoryAccount = await requireAccount(tx, context.companyId, "1200");
    const invoiceNumber = await nextDocumentNumber(tx, context.companyId, "SALES_INVOICE");
    const journalNumber = await nextDocumentNumber(tx, context.companyId, "JOURNAL_ENTRY");
    const preparedLines = [];

    for (const [index, line] of rawLines.entries()) {
      const productVariantId = requiredString(line.productVariantId, "Product variant");
      const variant = await tx.productVariant.findFirst({
        where: { id: productVariantId, companyId: context.companyId, status: "ACTIVE", product: { status: "ACTIVE" } },
        include: { product: { include: { hsnCode: true, taxRate: true } } },
      });

      if (!variant) {
        throw new ApiError(404, "PRODUCT_VARIANT_NOT_FOUND", "Product variant not found or inactive.");
      }

      const quantity = positiveDecimal(line.quantity, "Quantity", 3);
      const unitPrice = unitPriceOrDefault(line, new Prisma.Decimal(variant.salePrice ?? 0));
      const location = await validateLineLocation(tx, context.companyId, warehouseId, line);
      const key = locationKey({ warehouseId, ...location });
      const balance = await tx.stockBalance.findUnique({
        where: {
          companyId_productVariantId_warehouseId_locationKey: {
            companyId: context.companyId,
            productVariantId,
            warehouseId,
            locationKey: key,
          },
        },
      });

      if (!balance || new Prisma.Decimal(balance.quantity).lt(quantity)) {
        throw new ApiError(400, "INSUFFICIENT_STOCK", `${variant.name} does not have enough available stock.`);
      }

      const unitCost = new Prisma.Decimal(balance.averageCost ?? 0);
      const grossAmount = quantity.mul(unitPrice).toDecimalPlaces(2);
      const discountAmount = calculateDiscount(line, grossAmount);
      const taxableAmount = grossAmount.minus(discountAmount).toDecimalPlaces(2);
      const taxRate = variant.product.taxRate;
      const cgstRate = taxMode === "CGST_SGST" ? taxRate?.cgstRate ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
      const sgstRate = taxMode === "CGST_SGST" ? taxRate?.sgstRate ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
      const igstRate = taxMode === "IGST" ? taxRate?.igstRate ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
      const cgstAmount = taxableAmount.mul(cgstRate).div(100).toDecimalPlaces(2);
      const sgstAmount = taxableAmount.mul(sgstRate).div(100).toDecimalPlaces(2);
      const igstAmount = taxableAmount.mul(igstRate).div(100).toDecimalPlaces(2);
      const lineTotal = taxableAmount.plus(cgstAmount).plus(sgstAmount).plus(igstAmount).toDecimalPlaces(2);
      const costAmount = quantity.mul(unitCost).toDecimalPlaces(2);

      preparedLines.push({
        companyId: context.companyId,
        productId: variant.productId,
        productVariantId,
        ...location,
        locationKey: key,
        hsnCode: variant.product.hsnCode?.code,
        quantity,
        unitPrice,
        discountAmount,
        unitCost,
        taxableAmount,
        cgstRate,
        sgstRate,
        igstRate,
        cgstAmount,
        sgstAmount,
        igstAmount,
        lineTotal,
        costAmount,
        lineOrder: index + 1,
      });
    }

    if (sourceOrder || sourceChallan) {
      const sourceDocument = sourceChallan ?? sourceOrder;
      const sourceQuantities = new Map<string, Prisma.Decimal>();
      const invoiceQuantities = new Map<string, Prisma.Decimal>();

      for (const line of sourceDocument?.lines ?? []) {
        addQuantity(sourceQuantities, line.productVariantId, new Prisma.Decimal(line.quantity));
      }
      for (const line of preparedLines) {
        addQuantity(invoiceQuantities, line.productVariantId, line.quantity);
      }

      const alreadyInvoiced = await tx.salesInvoiceLine.groupBy({
        by: ["productVariantId"],
        where: {
          companyId: context.companyId,
          salesInvoice: sourceChallan
            ? { deliveryChallanId: sourceChallan.id, status: "POSTED" }
            : { salesOrderId: sourceOrder?.id, deliveryChallanId: null, status: "POSTED" },
        },
        _sum: { quantity: true },
      });

      for (const row of alreadyInvoiced) {
        addQuantity(sourceQuantities, row.productVariantId, new Prisma.Decimal(row._sum.quantity ?? 0).negated());
      }

      for (const [productVariantId, quantity] of invoiceQuantities.entries()) {
        const remaining = sourceQuantities.get(productVariantId) ?? new Prisma.Decimal(0);
        if (quantity.gt(remaining)) {
          throw new ApiError(400, "SOURCE_QUANTITY_EXCEEDED", "Sales invoice quantity exceeds the remaining source document quantity.");
        }
      }
    }

    const taxableAmount = preparedLines.reduce((total, line) => total.plus(line.taxableAmount), new Prisma.Decimal(0));
    const cgstAmount = preparedLines.reduce((total, line) => total.plus(line.cgstAmount), new Prisma.Decimal(0));
    const sgstAmount = preparedLines.reduce((total, line) => total.plus(line.sgstAmount), new Prisma.Decimal(0));
    const igstAmount = preparedLines.reduce((total, line) => total.plus(line.igstAmount), new Prisma.Decimal(0));
    const totalTaxAmount = cgstAmount.plus(sgstAmount).plus(igstAmount).toDecimalPlaces(2);
    const grandTotal = taxableAmount.plus(totalTaxAmount).toDecimalPlaces(2);
    const costOfGoodsSold = preparedLines.reduce((total, line) => total.plus(line.costAmount), new Prisma.Decimal(0));
    const ledgerPosition = await getCustomerLedgerPosition(tx, context.companyId, customerId);
    const creditLimit = new Prisma.Decimal(customer.creditLimit ?? 0);
    const projectedOutstanding = ledgerPosition.outstanding.plus(grandTotal).toDecimalPlaces(2);

    if (creditLimit.gt(0) && projectedOutstanding.gt(creditLimit)) {
      throw new ApiError(400, "CUSTOMER_CREDIT_LIMIT_EXCEEDED", "Sales invoice would exceed the customer's credit limit.");
    }

    if (customer.creditDays > 0 && ledgerPosition.oldestOpenDebit) {
      const oldestAllowedDate = new Date(invoiceDate);
      oldestAllowedDate.setDate(oldestAllowedDate.getDate() - customer.creditDays);

      if (ledgerPosition.oldestOpenDebit.entryDate < oldestAllowedDate) {
        throw new ApiError(400, "CUSTOMER_OVERDUE_BALANCE", "Customer has overdue outstanding balance beyond allowed credit days.");
      }
    }

    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId: context.companyId,
        entryNumber: journalNumber,
        entryDate: invoiceDate,
        sourceModule: "sales",
        sourceType: "SALES_INVOICE",
        narration: `Sales invoice ${invoiceNumber}`,
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: receivableAccount.id, debitAmount: grandTotal, narration: `Customer receivable ${invoiceNumber}`, lineOrder: 1 },
            { accountId: revenueAccount.id, creditAmount: taxableAmount, narration: `Sales revenue ${invoiceNumber}`, lineOrder: 2 },
            ...(totalTaxAmount.gt(0)
              ? [{ accountId: gstPayableAccount.id, creditAmount: totalTaxAmount, narration: `GST payable ${invoiceNumber}`, lineOrder: 3 }]
              : []),
            { accountId: cogsAccount.id, debitAmount: costOfGoodsSold, narration: `COGS ${invoiceNumber}`, lineOrder: 4 },
            { accountId: inventoryAccount.id, creditAmount: costOfGoodsSold, narration: `Inventory issue ${invoiceNumber}`, lineOrder: 5 },
          ],
        },
      },
    });

    const invoice = await tx.salesInvoice.create({
      data: {
        companyId: context.companyId,
        customerId,
        warehouseId,
        salesOrderId,
        deliveryChallanId,
        invoiceNumber,
        invoiceDate,
        taxMode,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalTaxAmount,
        grandTotal,
        costOfGoodsSold,
        status: "POSTED",
        journalEntryId: journalEntry.id,
        postedByUserId: context.userId,
        postedAt: new Date(),
        narration: optionalString(data.narration),
        lines: { create: preparedLines.map(({ locationKey: _locationKey, ...line }) => line) },
      },
      include: { customer: true, warehouse: true, salesOrder: true, deliveryChallan: true, lines: { include: { product: true, productVariant: true } } },
    });

    for (const line of preparedLines) {
      const balance = await tx.stockBalance.findUniqueOrThrow({
        where: {
          companyId_productVariantId_warehouseId_locationKey: {
            companyId: context.companyId,
            productVariantId: line.productVariantId,
            warehouseId,
            locationKey: line.locationKey,
          },
        },
      });
      const newQuantity = new Prisma.Decimal(balance.quantity).minus(line.quantity);
      const newValue = new Prisma.Decimal(balance.stockValue).minus(line.costAmount).toDecimalPlaces(2);

      if (newQuantity.lt(0)) {
        throw new ApiError(400, "NEGATIVE_STOCK_BLOCKED", "Sales invoice posting would create negative stock.");
      }

      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantity: newQuantity, stockValue: newValue.lt(0) ? 0 : newValue },
      });

      await tx.stockMovement.create({
        data: {
          companyId: context.companyId,
          productId: line.productId,
          productVariantId: line.productVariantId,
          warehouseId,
          blockId: line.blockId,
          rackId: line.rackId,
          shelfId: line.shelfId,
          locationKey: line.locationKey,
          movementType: "SALES_INVOICE",
          documentType: "SALES_INVOICE",
          documentNumber: invoiceNumber,
          documentDate: invoiceDate,
          quantityOut: line.quantity,
          unitCost: line.unitCost,
          totalValue: line.costAmount,
          narration: optionalString(data.narration),
          createdByUserId: context.userId,
        },
      });
    }

    await tx.partyLedgerEntry.create({
      data: {
        companyId: context.companyId,
        partyType: "CUSTOMER",
        customerId,
        journalEntryId: journalEntry.id,
        entryType: "INVOICE",
        documentType: "SALES_INVOICE",
        documentId: invoice.id,
        documentNumber: invoiceNumber,
        entryDate: invoiceDate,
        debitAmount: grandTotal,
        narration: `Sales invoice ${invoiceNumber}`,
      },
    });

    await tx.journalEntry.update({ where: { id: journalEntry.id }, data: { sourceId: invoice.id } });
    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "sales",
        action: "POST",
        entityType: "SalesInvoice",
        entityId: invoice.id,
        description: "Sales invoice posted.",
        afterData: json(invoice),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return invoice;
  });
}

export async function cancelSalesInvoice(context: SalesContext, invoiceId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const reason = requiredString(data.reason, "Cancellation reason");
  const cancellationDate = parseDate(data.cancellationDate);

  return prisma.$transaction(async (tx) => {
    await requireOpenFinancialYear(tx, context.companyId, cancellationDate);

    const invoice = await tx.salesInvoice.findFirst({
      where: { id: invoiceId, companyId: context.companyId },
      include: {
        lines: true,
        journalEntry: { include: { lines: true } },
      },
    });

    if (!invoice) {
      throw new ApiError(404, "SALES_INVOICE_NOT_FOUND", "Sales invoice not found.");
    }

    if (invoice.status !== "POSTED") {
      throw new ApiError(400, "SALES_INVOICE_NOT_POSTED", "Only posted sales invoices can be cancelled.");
    }

    const journalNumber = await nextDocumentNumber(tx, context.companyId, "JOURNAL_ENTRY");

    for (const line of invoice.lines) {
      const key = locationKey({
        warehouseId: invoice.warehouseId,
        blockId: line.blockId ?? undefined,
        rackId: line.rackId ?? undefined,
        shelfId: line.shelfId ?? undefined,
      });
      const balance = await tx.stockBalance.findUnique({
        where: {
          companyId_productVariantId_warehouseId_locationKey: {
            companyId: context.companyId,
            productVariantId: line.productVariantId,
            warehouseId: invoice.warehouseId,
            locationKey: key,
          },
        },
      });
      const newQuantity = new Prisma.Decimal(balance?.quantity ?? 0).plus(line.quantity);
      const newValue = new Prisma.Decimal(balance?.stockValue ?? 0).plus(line.costAmount).toDecimalPlaces(2);
      const averageCost = newValue.div(newQuantity).toDecimalPlaces(2);

      await tx.stockBalance.upsert({
        where: {
          companyId_productVariantId_warehouseId_locationKey: {
            companyId: context.companyId,
            productVariantId: line.productVariantId,
            warehouseId: invoice.warehouseId,
            locationKey: key,
          },
        },
        create: {
          companyId: context.companyId,
          productId: line.productId,
          productVariantId: line.productVariantId,
          warehouseId: invoice.warehouseId,
          blockId: line.blockId,
          rackId: line.rackId,
          shelfId: line.shelfId,
          locationKey: key,
          quantity: line.quantity,
          averageCost: line.unitCost,
          stockValue: line.costAmount,
        },
        update: { quantity: newQuantity, averageCost, stockValue: newValue },
      });

      await tx.stockMovement.create({
        data: {
          companyId: context.companyId,
          productId: line.productId,
          productVariantId: line.productVariantId,
          warehouseId: invoice.warehouseId,
          blockId: line.blockId,
          rackId: line.rackId,
          shelfId: line.shelfId,
          locationKey: key,
          movementType: "SALES_RETURN",
          documentType: "SALES_INVOICE_CANCEL",
          documentNumber: invoice.invoiceNumber,
          documentDate: cancellationDate,
          quantityIn: line.quantity,
          unitCost: line.unitCost,
          totalValue: line.costAmount,
          narration: reason,
          createdByUserId: context.userId,
        },
      });
    }

    const reversalJournal = await tx.journalEntry.create({
      data: {
        companyId: context.companyId,
        entryNumber: journalNumber,
        entryDate: cancellationDate,
        sourceModule: "sales",
        sourceType: "SALES_INVOICE_CANCEL",
        sourceId: invoice.id,
        narration: `Cancel sales invoice ${invoice.invoiceNumber}`,
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: {
          create: (invoice.journalEntry?.lines ?? []).map((line, index) => ({
            accountId: line.accountId,
            debitAmount: line.creditAmount,
            creditAmount: line.debitAmount,
            narration: `Reversal ${invoice.invoiceNumber}`,
            lineOrder: index + 1,
          })),
        },
      },
    });

    await tx.partyLedgerEntry.create({
      data: {
        companyId: context.companyId,
        partyType: "CUSTOMER",
        customerId: invoice.customerId,
        journalEntryId: reversalJournal.id,
        entryType: "ADJUSTMENT",
        documentType: "SALES_INVOICE_CANCEL",
        documentId: invoice.id,
        documentNumber: invoice.invoiceNumber,
        entryDate: new Date(),
        creditAmount: invoice.grandTotal,
        narration: reason,
      },
    });

    const cancelled = await tx.salesInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "CANCELLED",
        cancelledByUserId: context.userId,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "sales",
        action: "CANCEL",
        entityType: "SalesInvoice",
        entityId: invoice.id,
        description: "Sales invoice cancelled.",
        beforeData: json(invoice),
        afterData: json(cancelled),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return cancelled;
  });
}

export async function postSalesReturn(context: SalesContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const salesInvoiceId = requiredString(data.salesInvoiceId, "Sales invoice");
  const returnDate = parseDate(data.returnDate);
  const reason = requiredString(data.reason, "Reason");
  const rawLines = Array.isArray(data.lines) ? (data.lines as ReturnLineInput[]) : [];

  if (rawLines.length === 0) {
    throw new ApiError(400, "RETURN_LINES_REQUIRED", "At least one return line is required.");
  }

  return prisma.$transaction(async (tx) => {
    await requireOpenFinancialYear(tx, context.companyId, returnDate);

    const invoice = await tx.salesInvoice.findFirst({
      where: { id: salesInvoiceId, companyId: context.companyId, status: "POSTED" },
      include: { lines: true, customer: true },
    });

    if (!invoice) {
      throw new ApiError(404, "SALES_INVOICE_NOT_FOUND", "Posted sales invoice not found.");
    }

    const receivableAccount = await requireAccount(tx, context.companyId, "1100");
    const revenueAccount = await requireAccount(tx, context.companyId, "4000");
    const gstPayableAccount = await requireAccount(tx, context.companyId, "2100");
    const cogsAccount = await requireAccount(tx, context.companyId, "5000");
    const inventoryAccount = await requireAccount(tx, context.companyId, "1200");
    const returnNumber = await nextDocumentNumber(tx, context.companyId, "SALES_RETURN");
    const journalNumber = await nextDocumentNumber(tx, context.companyId, "JOURNAL_ENTRY");
    const preparedLines = [];

    for (const [index, line] of rawLines.entries()) {
      const salesInvoiceLineId = requiredString(line.salesInvoiceLineId, "Sales invoice line");
      const invoiceLine = invoice.lines.find((item) => item.id === salesInvoiceLineId);

      if (!invoiceLine) {
        throw new ApiError(400, "INVALID_RETURN_LINE", "Return line does not belong to the selected invoice.");
      }

      const quantity = positiveDecimal(line.quantity, "Return quantity", 3);

      if (quantity.gt(invoiceLine.quantity)) {
        throw new ApiError(400, "RETURN_QUANTITY_EXCEEDS_INVOICE", "Return quantity cannot exceed invoice quantity.");
      }

      const ratio = quantity.div(invoiceLine.quantity);
      preparedLines.push({
        companyId: context.companyId,
        productId: invoiceLine.productId,
        productVariantId: invoiceLine.productVariantId,
        blockId: invoiceLine.blockId,
        rackId: invoiceLine.rackId,
        shelfId: invoiceLine.shelfId,
        hsnCode: invoiceLine.hsnCode,
        quantity,
        unitPrice: invoiceLine.unitPrice,
        unitCost: invoiceLine.unitCost,
        taxableAmount: invoiceLine.taxableAmount.mul(ratio).toDecimalPlaces(2),
        cgstAmount: invoiceLine.cgstAmount.mul(ratio).toDecimalPlaces(2),
        sgstAmount: invoiceLine.sgstAmount.mul(ratio).toDecimalPlaces(2),
        igstAmount: invoiceLine.igstAmount.mul(ratio).toDecimalPlaces(2),
        lineTotal: invoiceLine.lineTotal.mul(ratio).toDecimalPlaces(2),
        costAmount: invoiceLine.costAmount.mul(ratio).toDecimalPlaces(2),
        lineOrder: index + 1,
      });
    }

    const taxableAmount = preparedLines.reduce((total, line) => total.plus(line.taxableAmount), new Prisma.Decimal(0));
    const cgstAmount = preparedLines.reduce((total, line) => total.plus(line.cgstAmount), new Prisma.Decimal(0));
    const sgstAmount = preparedLines.reduce((total, line) => total.plus(line.sgstAmount), new Prisma.Decimal(0));
    const igstAmount = preparedLines.reduce((total, line) => total.plus(line.igstAmount), new Prisma.Decimal(0));
    const totalTaxAmount = cgstAmount.plus(sgstAmount).plus(igstAmount).toDecimalPlaces(2);
    const grandTotal = taxableAmount.plus(totalTaxAmount).toDecimalPlaces(2);
    const costOfGoodsSold = preparedLines.reduce((total, line) => total.plus(line.costAmount), new Prisma.Decimal(0));

    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId: context.companyId,
        entryNumber: journalNumber,
        entryDate: returnDate,
        sourceModule: "sales",
        sourceType: "SALES_RETURN",
        narration: `Sales return ${returnNumber}`,
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: revenueAccount.id, debitAmount: taxableAmount, narration: returnNumber, lineOrder: 1 },
            ...(totalTaxAmount.gt(0)
              ? [{ accountId: gstPayableAccount.id, debitAmount: totalTaxAmount, narration: returnNumber, lineOrder: 2 }]
              : []),
            { accountId: receivableAccount.id, creditAmount: grandTotal, narration: returnNumber, lineOrder: 3 },
            { accountId: inventoryAccount.id, debitAmount: costOfGoodsSold, narration: returnNumber, lineOrder: 4 },
            { accountId: cogsAccount.id, creditAmount: costOfGoodsSold, narration: returnNumber, lineOrder: 5 },
          ],
        },
      },
    });

    const salesReturn = await tx.salesReturn.create({
      data: {
        companyId: context.companyId,
        salesInvoiceId: invoice.id,
        customerId: invoice.customerId,
        warehouseId: invoice.warehouseId,
        returnNumber,
        returnDate,
        reason,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalTaxAmount,
        grandTotal,
        costOfGoodsSold,
        journalEntryId: journalEntry.id,
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: { create: preparedLines },
      },
      include: { customer: true, warehouse: true, salesInvoice: true, lines: { include: { product: true, productVariant: true } } },
    });

    for (const line of preparedLines) {
      const key = locationKey({
        warehouseId: invoice.warehouseId,
        blockId: line.blockId ?? undefined,
        rackId: line.rackId ?? undefined,
        shelfId: line.shelfId ?? undefined,
      });
      const balance = await tx.stockBalance.findUnique({
        where: {
          companyId_productVariantId_warehouseId_locationKey: {
            companyId: context.companyId,
            productVariantId: line.productVariantId,
            warehouseId: invoice.warehouseId,
            locationKey: key,
          },
        },
      });
      const newQuantity = new Prisma.Decimal(balance?.quantity ?? 0).plus(line.quantity);
      const newValue = new Prisma.Decimal(balance?.stockValue ?? 0).plus(line.costAmount).toDecimalPlaces(2);
      const averageCost = newValue.div(newQuantity).toDecimalPlaces(2);

      await tx.stockBalance.upsert({
        where: {
          companyId_productVariantId_warehouseId_locationKey: {
            companyId: context.companyId,
            productVariantId: line.productVariantId,
            warehouseId: invoice.warehouseId,
            locationKey: key,
          },
        },
        create: {
          companyId: context.companyId,
          productId: line.productId,
          productVariantId: line.productVariantId,
          warehouseId: invoice.warehouseId,
          blockId: line.blockId,
          rackId: line.rackId,
          shelfId: line.shelfId,
          locationKey: key,
          quantity: line.quantity,
          averageCost: line.unitCost,
          stockValue: line.costAmount,
        },
        update: { quantity: newQuantity, averageCost, stockValue: newValue },
      });

      await tx.stockMovement.create({
        data: {
          companyId: context.companyId,
          productId: line.productId,
          productVariantId: line.productVariantId,
          warehouseId: invoice.warehouseId,
          blockId: line.blockId,
          rackId: line.rackId,
          shelfId: line.shelfId,
          locationKey: key,
          movementType: "SALES_RETURN",
          documentType: "SALES_RETURN",
          documentNumber: returnNumber,
          documentDate: returnDate,
          quantityIn: line.quantity,
          unitCost: line.unitCost,
          totalValue: line.costAmount,
          narration: reason,
          createdByUserId: context.userId,
        },
      });
    }

    await tx.partyLedgerEntry.create({
      data: {
        companyId: context.companyId,
        partyType: "CUSTOMER",
        customerId: invoice.customerId,
        journalEntryId: journalEntry.id,
        entryType: "CREDIT_NOTE",
        documentType: "SALES_RETURN",
        documentId: salesReturn.id,
        documentNumber: returnNumber,
        entryDate: returnDate,
        creditAmount: grandTotal,
        narration: reason,
      },
    });

    await tx.journalEntry.update({ where: { id: journalEntry.id }, data: { sourceId: salesReturn.id } });
    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "sales",
        action: "POST",
        entityType: "SalesReturn",
        entityId: salesReturn.id,
        description: "Sales return posted.",
        afterData: json(salesReturn),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return salesReturn;
  });
}
