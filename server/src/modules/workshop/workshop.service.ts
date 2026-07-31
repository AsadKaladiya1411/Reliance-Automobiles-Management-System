import { Prisma } from "../../generated/prisma/client";
import prisma from "../../lib/prisma";
import type { RequestContext } from "../../types/request-context";
import { ApiError } from "../../utils/api-error";
import { requireOpenFinancialYear } from "../financial-year/fiscal-period.service";
import { formatDocumentNumber } from "../number-series/number-series.service";

type WorkshopContext = RequestContext & {
  companyId: string;
  userId: string;
};

type PartInput = {
  productVariantId?: unknown;
  quantity?: unknown;
  estimatedRate?: unknown;
};

type LaborInput = {
  description?: unknown;
  estimatedAmount?: unknown;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_WORKSHOP_INPUT", `${field} is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function nonNegativeDecimal(value: unknown, field: string, scale = 2) {
  const number = value === undefined || value === null || value === "" ? 0 : Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new ApiError(400, "INVALID_WORKSHOP_NUMBER", `${field} must be non-negative.`);
  }

  return new Prisma.Decimal(number.toFixed(scale));
}

function positiveDecimal(value: unknown, field: string, scale = 3) {
  const decimal = nonNegativeDecimal(value, field, scale);

  if (decimal.lte(0)) {
    throw new ApiError(400, "INVALID_WORKSHOP_NUMBER", `${field} must be greater than zero.`);
  }

  return decimal;
}

function nonNegativeInteger(value: unknown, field: string) {
  const number = value === undefined || value === null || value === "" ? 0 : Number(value);

  if (!Number.isInteger(number) || number < 0) {
    throw new ApiError(400, "INVALID_WORKSHOP_INTEGER", `${field} must be a non-negative whole number.`);
  }

  return number;
}

function parseDate(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "INVALID_DATE", "Job card date is invalid.");
  }

  return date;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function inspectionChecklist(value: unknown): Prisma.InputJsonValue | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      label: optionalString(item.label) ?? "Inspection item",
      checked: Boolean(item.checked),
    })) as Prisma.InputJsonValue;
}

function locationKey(input: { warehouseId: string }) {
  return [input.warehouseId, "-", "-", "-"].join(":");
}

async function nextJobCardNumber(tx: Prisma.TransactionClient, companyId: string) {
  const series = await tx.numberSeries.findFirst({
    where: { companyId, documentType: "JOB_CARD", status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });

  if (!series) {
    throw new ApiError(400, "NUMBER_SERIES_MISSING", "Create a JOB_CARD number series before creating job cards.");
  }

  await tx.numberSeries.update({ where: { id: series.id }, data: { nextNumber: { increment: 1 } } });
  return formatDocumentNumber(series);
}

async function nextJournalNumber(tx: Prisma.TransactionClient, companyId: string) {
  const series = await tx.numberSeries.findFirst({
    where: { companyId, documentType: "JOURNAL_ENTRY", status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });

  if (!series) {
    throw new ApiError(400, "NUMBER_SERIES_MISSING", "Create a JOURNAL_ENTRY number series before issuing workshop parts.");
  }

  await tx.numberSeries.update({ where: { id: series.id }, data: { nextNumber: { increment: 1 } } });
  return formatDocumentNumber(series);
}

async function nextWorkshopInvoiceNumber(tx: Prisma.TransactionClient, companyId: string) {
  const series = await tx.numberSeries.findFirst({
    where: { companyId, documentType: "WORKSHOP_INVOICE", status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });

  if (!series) {
    throw new ApiError(400, "NUMBER_SERIES_MISSING", "Create a WORKSHOP_INVOICE number series before billing job cards.");
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

function optionalTaxMode(value: unknown) {
  const taxMode = (optionalString(value) ?? "CGST_SGST").toUpperCase();

  if (!["CGST_SGST", "IGST"].includes(taxMode)) {
    throw new ApiError(400, "INVALID_TAX_MODE", "Tax mode must be CGST_SGST or IGST.");
  }

  return taxMode;
}

export async function getWorkshopSummary(companyId: string) {
  const [open, inProgress, ready, delivered] = await Promise.all([
    prisma.jobCard.count({ where: { companyId, status: "OPEN" } }),
    prisma.jobCard.count({ where: { companyId, status: "IN_PROGRESS" } }),
    prisma.jobCard.count({ where: { companyId, status: "READY" } }),
    prisma.jobCard.count({ where: { companyId, status: "DELIVERED" } }),
  ]);

  return { open, inProgress, ready, delivered };
}

export async function listJobCards(companyId: string) {
  return prisma.jobCard.findMany({
    where: { companyId },
    include: {
      customer: true,
      vehicle: true,
      advisor: true,
      technician: true,
      parts: { include: { productVariant: true }, orderBy: { lineOrder: "asc" } },
      laborLines: { orderBy: { lineOrder: "asc" } },
    },
    orderBy: [{ jobDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function listServiceHistory(companyId: string, vehicleId?: string, customerId?: string) {
  return prisma.jobCard.findMany({
    where: {
      companyId,
      ...(vehicleId ? { vehicleId } : {}),
      ...(customerId ? { customerId } : {}),
      OR: [{ status: "DELIVERED" }, { billedAt: { not: null } }],
    },
    include: {
      customer: true,
      vehicle: true,
      advisor: true,
      technician: true,
      parts: { include: { productVariant: true }, orderBy: { lineOrder: "asc" } },
      laborLines: { orderBy: { lineOrder: "asc" } },
    },
    orderBy: [{ deliveredAt: "desc" }, { billedAt: "desc" }, { jobDate: "desc" }],
    take: 100,
  });
}

export async function createJobCard(context: WorkshopContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const customerId = requiredString(data.customerId, "Customer");
  const vehicleId = requiredString(data.vehicleId, "Vehicle");
  const advisorEmployeeId = optionalString(data.advisorEmployeeId);
  const technicianEmployeeId = optionalString(data.technicianEmployeeId);
  const rawParts = Array.isArray(data.parts) ? (data.parts as PartInput[]) : [];
  const rawLabor = Array.isArray(data.laborLines) ? (data.laborLines as LaborInput[]) : [];

  return prisma.$transaction(async (tx) => {
    const [customer, vehicle] = await Promise.all([
      tx.customer.findFirst({ where: { id: customerId, companyId: context.companyId, status: "ACTIVE" } }),
      tx.vehicle.findFirst({ where: { id: vehicleId, companyId: context.companyId, status: "ACTIVE" } }),
    ]);

    if (!customer) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found or inactive.");
    }

    if (!vehicle || vehicle.customerId !== customerId) {
      throw new ApiError(404, "VEHICLE_NOT_FOUND", "Vehicle not found for the selected customer.");
    }

    for (const employeeId of [advisorEmployeeId, technicianEmployeeId].filter(Boolean)) {
      const employee = await tx.employee.findFirst({
        where: { id: employeeId, companyId: context.companyId, status: "ACTIVE" },
      });
      if (!employee) {
        throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Advisor or technician not found or inactive.");
      }
    }

    const parts = [];
    for (const [index, part] of rawParts.entries()) {
      const productVariantId = requiredString(part.productVariantId, "Product variant");
      const productVariant = await tx.productVariant.findFirst({
        where: { id: productVariantId, companyId: context.companyId, status: "ACTIVE" },
      });

      if (!productVariant) {
        throw new ApiError(404, "PRODUCT_VARIANT_NOT_FOUND", "Product variant not found or inactive.");
      }

      const quantity = positiveDecimal(part.quantity, "Part quantity");
      const estimatedRate = nonNegativeDecimal(part.estimatedRate, "Estimated rate");
      parts.push({
        productVariantId,
        quantity,
        estimatedRate,
        estimatedAmount: quantity.mul(estimatedRate).toDecimalPlaces(2),
        lineOrder: index + 1,
      });
    }

    const laborLines = rawLabor
      .filter((line) => optionalString(line.description))
      .map((line, index) => ({
        description: requiredString(line.description, "Labor description"),
        estimatedAmount: nonNegativeDecimal(line.estimatedAmount, "Labor amount"),
        lineOrder: index + 1,
      }));
    const estimatedPartsTotal = parts.reduce((total, part) => total.plus(part.estimatedAmount), new Prisma.Decimal(0));
    const estimatedLaborTotal = laborLines.reduce((total, labor) => total.plus(labor.estimatedAmount), new Prisma.Decimal(0));
    const jobCardNumber = await nextJobCardNumber(tx, context.companyId);

    const jobCard = await tx.jobCard.create({
      data: {
        companyId: context.companyId,
        customerId,
        vehicleId,
        advisorEmployeeId,
        technicianEmployeeId,
        jobCardNumber,
        jobDate: parseDate(data.jobDate),
        expectedDeliveryAt: data.expectedDeliveryAt ? parseDate(data.expectedDeliveryAt) : undefined,
        odometerReading: nonNegativeInteger(data.odometerReading, "Odometer reading"),
        fuelLevel: optionalString(data.fuelLevel),
        complaint: requiredString(data.complaint, "Complaint"),
        diagnosis: optionalString(data.diagnosis),
        workNotes: optionalString(data.workNotes),
        estimatedPartsTotal,
        estimatedLaborTotal,
        estimatedTotal: estimatedPartsTotal.plus(estimatedLaborTotal).toDecimalPlaces(2),
        parts: { create: parts },
        laborLines: { create: laborLines },
      },
      include: {
        customer: true,
        vehicle: true,
        serviceTaxRate: { include: { hsnCode: true } },
        advisor: true,
        technician: true,
        parts: { include: { productVariant: true } },
        laborLines: true,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "workshop",
        action: "CREATE",
        entityType: "JobCard",
        entityId: jobCard.id,
        description: "Job card created.",
        afterData: json(jobCard),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return jobCard;
  });
}

export async function updateJobCardStatus(context: WorkshopContext, jobCardId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const status = requiredString(data.status, "Status").toUpperCase();

  if (!["OPEN", "IN_PROGRESS", "READY", "DELIVERED", "CANCELLED"].includes(status)) {
    throw new ApiError(400, "INVALID_JOB_CARD_STATUS", "Job card status is invalid.");
  }

  const existing = await prisma.jobCard.findFirst({ where: { id: jobCardId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "JOB_CARD_NOT_FOUND", "Job card not found.");
  }

  if (status === "READY" && !existing.qualityCheckedAt) {
    throw new ApiError(400, "JOB_CARD_QC_REQUIRED", "Complete inspection before marking the job card ready.");
  }

  if (status === "DELIVERED" && !existing.billedAt) {
    throw new ApiError(400, "JOB_CARD_BILLING_REQUIRED", "Bill the job card before delivery closeout.");
  }

  const updated = await prisma.jobCard.update({
    where: { id: existing.id },
    data: {
      status: status as "OPEN" | "IN_PROGRESS" | "READY" | "DELIVERED" | "CANCELLED",
      workNotes: optionalString(data.workNotes) ?? existing.workNotes,
      deliveryNotes: status === "DELIVERED" ? optionalString(data.deliveryNotes) ?? existing.deliveryNotes : existing.deliveryNotes,
      readyAt: status === "READY" && !existing.readyAt ? new Date() : existing.readyAt,
      deliveredAt: status === "DELIVERED" && !existing.deliveredAt ? new Date() : existing.deliveredAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: context.companyId,
      actorUserId: context.userId,
      module: "workshop",
      action: "UPDATE",
      entityType: "JobCard",
      entityId: existing.id,
      description: "Job card status updated.",
      beforeData: json(existing),
      afterData: json(updated),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });

  return updated;
}

export async function updateJobCardInspection(context: WorkshopContext, jobCardId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.jobCard.findFirst({ where: { id: jobCardId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "JOB_CARD_NOT_FOUND", "Job card not found.");
  }

  if (existing.status === "CANCELLED" || existing.status === "DELIVERED") {
    throw new ApiError(400, "JOB_CARD_CLOSED", "Inspection cannot be changed after cancellation or delivery.");
  }

  const checklist = inspectionChecklist(data.inspectionChecklist);
  const updated = await prisma.jobCard.update({
    where: { id: existing.id },
    data: {
      diagnosis: optionalString(data.diagnosis) ?? existing.diagnosis,
      workNotes: optionalString(data.workNotes) ?? existing.workNotes,
      ...(checklist ? { inspectionChecklist: checklist } : {}),
      inspectionNotes: optionalString(data.inspectionNotes) ?? existing.inspectionNotes,
      qualityCheckedByUserId: context.userId,
      qualityCheckedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: context.companyId,
      actorUserId: context.userId,
      module: "workshop",
      action: "UPDATE",
      entityType: "JobCardInspection",
      entityId: existing.id,
      description: "Job card inspection updated.",
      beforeData: json(existing),
      afterData: json(updated),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });

  return updated;
}

export async function updateJobCardTechnician(context: WorkshopContext, jobCardId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const technicianStatus = requiredString(data.technicianStatus, "Technician status").toUpperCase();

  if (!["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "ON_HOLD"].includes(technicianStatus)) {
    throw new ApiError(400, "INVALID_TECHNICIAN_STATUS", "Technician status is invalid.");
  }

  const existing = await prisma.jobCard.findFirst({ where: { id: jobCardId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "JOB_CARD_NOT_FOUND", "Job card not found.");
  }

  if (existing.status === "CANCELLED" || existing.status === "DELIVERED") {
    throw new ApiError(400, "JOB_CARD_CLOSED", "Technician progress cannot be changed after cancellation or delivery.");
  }

  const updated = await prisma.jobCard.update({
    where: { id: existing.id },
    data: {
      technicianStatus,
      technicianNotes: optionalString(data.technicianNotes) ?? existing.technicianNotes,
      technicianStartedAt:
        technicianStatus === "IN_PROGRESS" && !existing.technicianStartedAt ? new Date() : existing.technicianStartedAt,
      technicianCompletedAt:
        technicianStatus === "COMPLETED" && !existing.technicianCompletedAt ? new Date() : existing.technicianCompletedAt,
      status: technicianStatus === "IN_PROGRESS" && existing.status === "OPEN" ? "IN_PROGRESS" : existing.status,
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: context.companyId,
      actorUserId: context.userId,
      module: "workshop",
      action: "UPDATE",
      entityType: "JobCardTechnicianProgress",
      entityId: existing.id,
      description: "Job card technician progress updated.",
      beforeData: json(existing),
      afterData: json(updated),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });

  return updated;
}

export async function issueJobCardParts(context: WorkshopContext, jobCardId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const warehouseId = requiredString(data.warehouseId, "Warehouse");
  const issueDate = parseDate(data.issueDate);

  return prisma.$transaction(async (tx) => {
    await requireOpenFinancialYear(tx, context.companyId, issueDate);

    const jobCard = await tx.jobCard.findFirst({
      where: { id: jobCardId, companyId: context.companyId },
      include: { parts: { include: { productVariant: { include: { product: true } } } } },
    });

    if (!jobCard) {
      throw new ApiError(404, "JOB_CARD_NOT_FOUND", "Job card not found.");
    }

    if (jobCard.status === "CANCELLED" || jobCard.status === "DELIVERED") {
      throw new ApiError(400, "JOB_CARD_CLOSED", "Parts cannot be issued for a cancelled or delivered job card.");
    }

    if (jobCard.partsIssuedAt) {
      throw new ApiError(400, "JOB_CARD_PARTS_ALREADY_ISSUED", "Parts have already been issued for this job card.");
    }

    if (jobCard.parts.length === 0) {
      throw new ApiError(400, "JOB_CARD_HAS_NO_PARTS", "Job card has no estimated parts to issue.");
    }

    const warehouse = await tx.warehouse.findFirst({
      where: { id: warehouseId, companyId: context.companyId, status: "ACTIVE" },
    });

    if (!warehouse) {
      throw new ApiError(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found or inactive.");
    }

    const inventoryAccount = await requireAccount(tx, context.companyId, "1200");
    const cogsAccount = await requireAccount(tx, context.companyId, "5000");
    const journalNumber = await nextJournalNumber(tx, context.companyId);
    const key = locationKey({ warehouseId });
    const preparedLines = [];

    for (const part of jobCard.parts) {
      const balance = await tx.stockBalance.findUnique({
        where: {
          companyId_productVariantId_warehouseId_locationKey: {
            companyId: context.companyId,
            productVariantId: part.productVariantId,
            warehouseId,
            locationKey: key,
          },
        },
      });

      if (!balance || new Prisma.Decimal(balance.quantity).lt(part.quantity)) {
        throw new ApiError(400, "INSUFFICIENT_STOCK", `${part.productVariant.name} does not have enough stock for this job card.`);
      }

      const unitCost = new Prisma.Decimal(balance.averageCost ?? 0);
      const totalValue = unitCost.mul(part.quantity).toDecimalPlaces(2);
      preparedLines.push({ part, balance, unitCost, totalValue });
    }

    const totalCost = preparedLines.reduce((total, line) => total.plus(line.totalValue), new Prisma.Decimal(0));
    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId: context.companyId,
        entryNumber: journalNumber,
        entryDate: issueDate,
        sourceModule: "workshop",
        sourceType: "WORKSHOP_PARTS_ISSUE",
        sourceId: jobCard.id,
        narration: `Workshop parts issue ${jobCard.jobCardNumber}`,
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: cogsAccount.id, debitAmount: totalCost, narration: jobCard.jobCardNumber, lineOrder: 1 },
            { accountId: inventoryAccount.id, creditAmount: totalCost, narration: jobCard.jobCardNumber, lineOrder: 2 },
          ],
        },
      },
    });
    const movements = [];

    for (const line of preparedLines) {
      const newQuantity = new Prisma.Decimal(line.balance.quantity).minus(line.part.quantity);
      const newValue = new Prisma.Decimal(line.balance.stockValue).minus(line.totalValue).toDecimalPlaces(2);

      await tx.stockBalance.update({
        where: { id: line.balance.id },
        data: {
          quantity: newQuantity,
          stockValue: newValue.lt(0) ? 0 : newValue,
          averageCost: newQuantity.gt(0) ? line.balance.averageCost : 0,
        },
      });

      movements.push(
        await tx.stockMovement.create({
          data: {
            companyId: context.companyId,
            productId: line.part.productVariant.productId,
            productVariantId: line.part.productVariantId,
            warehouseId,
            locationKey: key,
            movementType: "ADJUSTMENT_OUT",
          documentType: "WORKSHOP_PARTS_ISSUE",
          documentNumber: jobCard.jobCardNumber,
          documentDate: issueDate,
            quantityOut: line.part.quantity,
            unitCost: line.unitCost,
            totalValue: line.totalValue,
            narration: `Workshop parts issue ${jobCard.jobCardNumber}`,
            createdByUserId: context.userId,
          },
        }),
      );
    }

    const updated = await tx.jobCard.update({
      where: { id: jobCard.id },
      data: {
        status: jobCard.status === "OPEN" ? "IN_PROGRESS" : jobCard.status,
        partsIssueWarehouseId: warehouseId,
        partsIssueJournalEntryId: journalEntry.id,
        partsIssuedByUserId: context.userId,
        partsIssuedAt: new Date(),
      },
      include: {
        customer: true,
        vehicle: true,
        advisor: true,
        technician: true,
        parts: { include: { productVariant: true }, orderBy: { lineOrder: "asc" } },
        laborLines: { orderBy: { lineOrder: "asc" } },
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "workshop",
        action: "POST",
        entityType: "JobCardPartsIssue",
        entityId: jobCard.id,
        description: "Workshop parts issued.",
        afterData: json({ jobCard: updated, movements, journalEntry }),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return updated;
  });
}

export async function postJobCardBilling(context: WorkshopContext, jobCardId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const billingDate = parseDate(data.billingDate);
  const serviceTaxRateId = optionalString(data.serviceTaxRateId);
  const taxMode = optionalTaxMode(data.taxMode);

  return prisma.$transaction(async (tx) => {
    await requireOpenFinancialYear(tx, context.companyId, billingDate);

    const jobCard = await tx.jobCard.findFirst({
      where: { id: jobCardId, companyId: context.companyId },
      include: {
        customer: true,
        vehicle: true,
        parts: { include: { productVariant: true }, orderBy: { lineOrder: "asc" } },
        laborLines: { orderBy: { lineOrder: "asc" } },
      },
    });

    if (!jobCard) {
      throw new ApiError(404, "JOB_CARD_NOT_FOUND", "Job card not found.");
    }

    if (jobCard.status === "CANCELLED") {
      throw new ApiError(400, "JOB_CARD_CANCELLED", "Cancelled job cards cannot be billed.");
    }

    if (jobCard.billedAt) {
      throw new ApiError(400, "JOB_CARD_ALREADY_BILLED", "Job card has already been billed.");
    }

    if (jobCard.parts.length > 0 && !jobCard.partsIssuedAt) {
      throw new ApiError(400, "JOB_CARD_PARTS_NOT_ISSUED", "Issue job card parts before billing so stock is consumed exactly once.");
    }

    const partsTotal = jobCard.parts.reduce((total, part) => total.plus(part.estimatedAmount), new Prisma.Decimal(0));
    const laborTotal = jobCard.laborLines.reduce((total, labor) => total.plus(labor.estimatedAmount), new Prisma.Decimal(0));
    const billingTaxableAmount = nonNegativeDecimal(data.billingAmount, "Billing amount").gt(0)
      ? nonNegativeDecimal(data.billingAmount, "Billing amount")
      : partsTotal.plus(laborTotal).toDecimalPlaces(2);

    if (billingTaxableAmount.lte(0)) {
      throw new ApiError(400, "JOB_CARD_BILLING_AMOUNT_REQUIRED", "Billing amount must be greater than zero.");
    }

    const serviceTaxRate = serviceTaxRateId
      ? await tx.taxRate.findFirst({
          where: { id: serviceTaxRateId, companyId: context.companyId, status: "ACTIVE" },
          include: { hsnCode: true },
        })
      : null;

    if (serviceTaxRateId && !serviceTaxRate) {
      throw new ApiError(404, "TAX_RATE_NOT_FOUND", "Service tax rate not found or inactive.");
    }

    const cgstRate = taxMode === "CGST_SGST" ? serviceTaxRate?.cgstRate ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
    const sgstRate = taxMode === "CGST_SGST" ? serviceTaxRate?.sgstRate ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
    const igstRate = taxMode === "IGST" ? serviceTaxRate?.igstRate ?? new Prisma.Decimal(0) : new Prisma.Decimal(0);
    const billingCgstAmount = billingTaxableAmount.mul(cgstRate).div(100).toDecimalPlaces(2);
    const billingSgstAmount = billingTaxableAmount.mul(sgstRate).div(100).toDecimalPlaces(2);
    const billingIgstAmount = billingTaxableAmount.mul(igstRate).div(100).toDecimalPlaces(2);
    const billingTotalTaxAmount = billingCgstAmount.plus(billingSgstAmount).plus(billingIgstAmount).toDecimalPlaces(2);
    const billingAmount = billingTaxableAmount.plus(billingTotalTaxAmount).toDecimalPlaces(2);

    const [receivableAccount, revenueAccount, gstPayableAccount] = await Promise.all([
      requireAccount(tx, context.companyId, "1100"),
      requireAccount(tx, context.companyId, "4000"),
      requireAccount(tx, context.companyId, "2100"),
    ]);
    const [billingNumber, journalNumber] = await Promise.all([
      nextWorkshopInvoiceNumber(tx, context.companyId),
      nextJournalNumber(tx, context.companyId),
    ]);

    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId: context.companyId,
        entryNumber: journalNumber,
        entryDate: billingDate,
        sourceModule: "workshop",
        sourceType: "WORKSHOP_INVOICE",
        sourceId: jobCard.id,
        narration: `Workshop invoice ${billingNumber}`,
        status: "POSTED",
        postedByUserId: context.userId,
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: receivableAccount.id, debitAmount: billingAmount, narration: billingNumber, lineOrder: 1 },
            { accountId: revenueAccount.id, creditAmount: billingTaxableAmount, narration: billingNumber, lineOrder: 2 },
            ...(billingTotalTaxAmount.gt(0)
              ? [{ accountId: gstPayableAccount.id, creditAmount: billingTotalTaxAmount, narration: billingNumber, lineOrder: 3 }]
              : []),
          ],
        },
      },
    });

    const updated = await tx.jobCard.update({
      where: { id: jobCard.id },
      data: {
        status: "DELIVERED",
        billingNumber,
        serviceTaxRateId: serviceTaxRate?.id,
        billingTaxMode: taxMode,
        billingHsnCode: serviceTaxRate?.hsnCode?.code,
        billingTaxableAmount,
        billingCgstAmount,
        billingSgstAmount,
        billingIgstAmount,
        billingTotalTaxAmount,
        billingAmount,
        billingJournalEntryId: journalEntry.id,
        billedByUserId: context.userId,
        billedAt: new Date(),
      },
      include: {
        customer: true,
        vehicle: true,
        serviceTaxRate: { include: { hsnCode: true } },
        advisor: true,
        technician: true,
        parts: { include: { productVariant: true }, orderBy: { lineOrder: "asc" } },
        laborLines: { orderBy: { lineOrder: "asc" } },
      },
    });

    await tx.partyLedgerEntry.create({
      data: {
        companyId: context.companyId,
        partyType: "CUSTOMER",
        customerId: jobCard.customerId,
        journalEntryId: journalEntry.id,
        entryType: "INVOICE",
        documentType: "WORKSHOP_INVOICE",
        documentId: jobCard.id,
        documentNumber: billingNumber,
        entryDate: billingDate,
        debitAmount: billingAmount,
        narration: `Workshop invoice ${billingNumber}`,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "workshop",
        action: "POST",
        entityType: "WorkshopInvoice",
        entityId: jobCard.id,
        description: "Workshop job card billed.",
        afterData: json({ jobCard: updated, journalEntry }),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return updated;
  });
}
