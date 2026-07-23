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

const defaultNumberSeries = [
  { documentType: "OPENING_STOCK", prefix: "OS-", padding: 5 },
  { documentType: "STOCK_ADJUSTMENT", prefix: "SA-", padding: 5 },
  { documentType: "STOCK_TRANSFER", prefix: "ST-", padding: 5 },
  { documentType: "JOURNAL_ENTRY", prefix: "JV-", padding: 5 },
  { documentType: "PURCHASE_INVOICE", prefix: "PI-", padding: 5 },
  { documentType: "SALES_INVOICE", prefix: "SI-", padding: 5 },
  { documentType: "PURCHASE_RETURN", prefix: "PR-", padding: 5 },
  { documentType: "SALES_RETURN", prefix: "SR-", padding: 5 },
  { documentType: "CREDIT_NOTE", prefix: "CN-", padding: 5 },
  { documentType: "DEBIT_NOTE", prefix: "DN-", padding: 5 },
  { documentType: "PAYMENT_RECEIPT", prefix: "RCPT-", padding: 5 },
  { documentType: "PAYMENT_VOUCHER", prefix: "PV-", padding: 5 },
  { documentType: "JOB_CARD", prefix: "JC-", padding: 5 },
] as const;

const defaultPaymentModes = [
  { code: "CASH", name: "Cash", paymentType: "Cash", requiresReference: false, isDefault: true },
  { code: "BANK", name: "Bank Transfer", paymentType: "Bank", requiresReference: true, isDefault: false },
  { code: "UPI", name: "UPI", paymentType: "UPI", requiresReference: true, isDefault: false },
  { code: "CARD", name: "Card", paymentType: "Card", requiresReference: true, isDefault: false },
] as const;

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

export async function seedOperationalDefaults(companyId: string, context: RequestContext) {
  const result = await prisma.$transaction(async (tx) => {
    const numberSeries = [];
    const paymentModes = [];

    for (const series of defaultNumberSeries) {
      numberSeries.push(
        await tx.numberSeries.upsert({
          where: {
            companyId_documentType_financialYear_prefix_suffix: {
              companyId,
              documentType: series.documentType,
              financialYear: "",
              prefix: series.prefix,
              suffix: "",
            },
          },
          create: {
            companyId,
            documentType: series.documentType,
            prefix: series.prefix,
            suffix: "",
            padding: series.padding,
            nextNumber: 1,
            financialYear: "",
          },
          update: { status: "ACTIVE" },
        }),
      );
    }

    for (const mode of defaultPaymentModes) {
      paymentModes.push(
        await tx.paymentMode.upsert({
          where: { companyId_code: { companyId, code: mode.code } },
          create: { companyId, ...mode },
          update: {
            name: mode.name,
            paymentType: mode.paymentType,
            requiresReference: mode.requiresReference,
            isDefault: mode.isDefault,
            status: "ACTIVE",
          },
        }),
      );
    }

    await tx.auditLog.create({
      data: {
        companyId,
        actorUserId: context.userId,
        module: "settings",
        action: "CREATE",
        entityType: "OperationalDefaults",
        description: "Operational defaults seeded.",
        afterData: { numberSeries, paymentModes },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return { numberSeries, paymentModes };
  });

  return result;
}
