import prisma from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import type { RequestContext } from "../../types/request-context";
import { writeAuditLog } from "../audit/audit.service";

type UpsertNumberSeriesInput = {
  documentType: string;
  prefix?: string;
  suffix?: string;
  padding?: number;
  nextNumber?: number;
  financialYear?: string;
};

export function formatDocumentNumber(input: {
  prefix: string;
  suffix: string;
  padding: number;
  nextNumber: number;
}) {
  return `${input.prefix}${String(input.nextNumber).padStart(input.padding, "0")}${input.suffix}`;
}

export async function listNumberSeries(companyId: string) {
  return prisma.numberSeries.findMany({
    where: { companyId },
    orderBy: [{ documentType: "asc" }, { createdAt: "asc" }],
  });
}

export async function createNumberSeries(
  companyId: string,
  input: UpsertNumberSeriesInput,
  context: RequestContext,
) {
  if (!input.documentType?.trim()) {
    throw new ApiError(400, "INVALID_NUMBER_SERIES", "Document type is required.");
  }

  const padding = input.padding ?? 5;
  const nextNumber = input.nextNumber ?? 1;

  if (!Number.isInteger(padding) || padding < 1 || padding > 12) {
    throw new ApiError(400, "INVALID_PADDING", "Padding must be between 1 and 12.");
  }

  if (!Number.isInteger(nextNumber) || nextNumber < 1) {
    throw new ApiError(400, "INVALID_NEXT_NUMBER", "Next number must be a positive integer.");
  }

  const numberSeries = await prisma.numberSeries.create({
    data: {
      companyId,
      documentType: input.documentType.trim().toUpperCase(),
      prefix: input.prefix?.trim() ?? "",
      suffix: input.suffix?.trim() ?? "",
      padding,
      nextNumber,
      financialYear: input.financialYear?.trim(),
    },
  });

  await writeAuditLog({
    ...context,
    companyId,
    module: "settings",
    action: "CREATE",
    entityType: "NumberSeries",
    entityId: numberSeries.id,
    description: "Number series created.",
    afterData: numberSeries,
  });

  return {
    ...numberSeries,
    preview: formatDocumentNumber(numberSeries),
  };
}
