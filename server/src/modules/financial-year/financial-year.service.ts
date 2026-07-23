import prisma from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import type { RequestContext } from "../../types/request-context";
import { writeAuditLog } from "../audit/audit.service";

type CreateFinancialYearInput = {
  name: string;
  startDate: string;
  endDate: string;
};

function parseDate(value: string, field: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "INVALID_DATE", `${field} must be a valid date.`);
  }

  return date;
}

export async function listFinancialYears(companyId: string) {
  return prisma.financialYear.findMany({
    where: { companyId },
    orderBy: { startDate: "desc" },
  });
}

export async function createFinancialYear(
  companyId: string,
  input: CreateFinancialYearInput,
  context: RequestContext,
) {
  if (!input.name?.trim()) {
    throw new ApiError(400, "INVALID_FINANCIAL_YEAR", "Financial year name is required.");
  }

  const startDate = parseDate(input.startDate, "Start date");
  const endDate = parseDate(input.endDate, "End date");

  if (startDate >= endDate) {
    throw new ApiError(400, "INVALID_FINANCIAL_YEAR_DATES", "Start date must be before end date.");
  }

  const overlap = await prisma.financialYear.findFirst({
    where: {
      companyId,
      OR: [
        { startDate: { lte: startDate }, endDate: { gte: startDate } },
        { startDate: { lte: endDate }, endDate: { gte: endDate } },
        { startDate: { gte: startDate }, endDate: { lte: endDate } },
      ],
    },
  });

  if (overlap) {
    throw new ApiError(
      409,
      "FINANCIAL_YEAR_OVERLAP",
      "Financial year dates overlap with an existing year.",
    );
  }

  const financialYear = await prisma.financialYear.create({
    data: {
      companyId,
      name: input.name.trim(),
      startDate,
      endDate,
    },
  });

  await writeAuditLog({
    ...context,
    companyId,
    module: "settings",
    action: "CREATE",
    entityType: "FinancialYear",
    entityId: financialYear.id,
    description: "Financial year created.",
    afterData: financialYear,
  });

  return financialYear;
}
