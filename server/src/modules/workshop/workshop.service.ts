import { Prisma } from "../../generated/prisma/client";
import prisma from "../../lib/prisma";
import type { RequestContext } from "../../types/request-context";
import { ApiError } from "../../utils/api-error";
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

  const updated = await prisma.jobCard.update({
    where: { id: existing.id },
    data: {
      status: status as "OPEN" | "IN_PROGRESS" | "READY" | "DELIVERED" | "CANCELLED",
      workNotes: optionalString(data.workNotes) ?? existing.workNotes,
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
