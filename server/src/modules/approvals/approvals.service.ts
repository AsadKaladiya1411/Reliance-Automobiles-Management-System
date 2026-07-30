import { Prisma } from "../../generated/prisma/client";
import prisma from "../../lib/prisma";
import type { RequestContext } from "../../types/request-context";
import { ApiError } from "../../utils/api-error";

type ApprovalContext = RequestContext & {
  companyId: string;
  userId: string;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_APPROVAL_INPUT", `${field} is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function optionalAmount(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new ApiError(400, "INVALID_APPROVAL_AMOUNT", "Amount must be non-negative.");
  }

  return new Prisma.Decimal(number.toFixed(2));
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function listApprovalRules(companyId: string) {
  return prisma.approvalRule.findMany({
    where: { companyId },
    orderBy: [{ module: "asc" }, { documentType: "asc" }, { triggerAction: "asc" }],
  });
}

export async function saveApprovalRule(context: ApprovalContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const module = requiredString(data.module, "Module").toLowerCase();
  const documentType = requiredString(data.documentType, "Document type").toUpperCase();
  const triggerAction = (optionalString(data.triggerAction) ?? "POST").toUpperCase();

  const rule = await prisma.approvalRule.upsert({
    where: {
      companyId_module_documentType_triggerAction: {
        companyId: context.companyId,
        module,
        documentType,
        triggerAction,
      },
    },
    create: {
      companyId: context.companyId,
      module,
      documentType,
      triggerAction,
      requireApproval: Boolean(data.requireApproval),
      minimumAmount: optionalAmount(data.minimumAmount),
      createdByUserId: context.userId,
    },
    update: {
      requireApproval: Boolean(data.requireApproval),
      minimumAmount: optionalAmount(data.minimumAmount),
      status: optionalString(data.status)?.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: context.companyId,
      actorUserId: context.userId,
      module: "settings",
      action: "UPDATE",
      entityType: "ApprovalRule",
      entityId: rule.id,
      description: "Approval rule saved.",
      afterData: json(rule),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });

  return rule;
}

export async function listApprovalRequests(companyId: string) {
  return prisma.approvalRequest.findMany({
    where: { companyId },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    take: 100,
  });
}

export async function approvalStatusForDocument(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    module: string;
    documentType: string;
    triggerAction?: string;
    amount?: Prisma.Decimal;
  },
) {
  const triggerAction = (input.triggerAction ?? "CREATE").toUpperCase();
  const rule = await tx.approvalRule.findFirst({
    where: {
      companyId: input.companyId,
      module: input.module.toLowerCase(),
      documentType: input.documentType.toUpperCase(),
      triggerAction,
      status: "ACTIVE",
      requireApproval: true,
    },
  });

  if (!rule) {
    return "APPROVED" as const;
  }

  if (rule.minimumAmount && input.amount && input.amount.lt(rule.minimumAmount)) {
    return "APPROVED" as const;
  }

  return "PENDING_APPROVAL" as const;
}

export async function createApprovalRequestForDocument(
  tx: Prisma.TransactionClient,
  context: ApprovalContext,
  input: {
    module: string;
    documentType: string;
    documentId: string;
    documentNumber: string;
    requestedAction?: string;
    amount?: Prisma.Decimal;
    reason?: string;
  },
) {
  return tx.approvalRequest.create({
    data: {
      companyId: context.companyId,
      module: input.module.toLowerCase(),
      documentType: input.documentType.toUpperCase(),
      documentId: input.documentId,
      documentNumber: input.documentNumber,
      requestedAction: (input.requestedAction ?? "CREATE").toUpperCase(),
      amount: input.amount,
      reason: input.reason,
      requestedByUserId: context.userId,
    },
  });
}

export async function submitApprovalRequest(context: ApprovalContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const request = await prisma.approvalRequest.create({
    data: {
      companyId: context.companyId,
      module: requiredString(data.module, "Module").toLowerCase(),
      documentType: requiredString(data.documentType, "Document type").toUpperCase(),
      documentId: optionalString(data.documentId),
      documentNumber: requiredString(data.documentNumber, "Document number"),
      requestedAction: (optionalString(data.requestedAction) ?? "POST").toUpperCase(),
      amount: optionalAmount(data.amount),
      reason: optionalString(data.reason),
      requestedByUserId: context.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: context.companyId,
      actorUserId: context.userId,
      module: request.module,
      action: "CREATE",
      entityType: "ApprovalRequest",
      entityId: request.id,
      description: "Approval request submitted.",
      afterData: json(request),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });

  return request;
}

export async function decideApprovalRequest(context: ApprovalContext, requestId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const decision = requiredString(data.decision, "Decision").toUpperCase();

  if (!["APPROVED", "REJECTED"].includes(decision)) {
    throw new ApiError(400, "INVALID_APPROVAL_DECISION", "Decision must be APPROVED or REJECTED.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.approvalRequest.findFirst({ where: { id: requestId, companyId: context.companyId } });
    if (!existing) {
      throw new ApiError(404, "APPROVAL_REQUEST_NOT_FOUND", "Approval request not found.");
    }

    if (existing.status !== "PENDING") {
      throw new ApiError(400, "APPROVAL_REQUEST_CLOSED", "Only pending approval requests can be decided.");
    }

    const updated = await tx.approvalRequest.update({
      where: { id: existing.id },
      data: {
        status: decision as "APPROVED" | "REJECTED",
        decisionNotes: optionalString(data.decisionNotes),
        decidedByUserId: context.userId,
        decidedAt: new Date(),
      },
    });

    if (decision === "APPROVED" && existing.documentId) {
      await approvePlanningDocument(tx, context.companyId, existing.documentType, existing.documentId);
    }

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: existing.module,
        action: decision === "APPROVED" ? "APPROVE" : "REJECT",
        entityType: "ApprovalRequest",
        entityId: existing.id,
        description: `Approval request ${decision.toLowerCase()}.`,
        beforeData: json(existing),
        afterData: json(updated),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return updated;
  });
}

async function approvePlanningDocument(
  tx: Prisma.TransactionClient,
  companyId: string,
  documentType: string,
  documentId: string,
) {
  switch (documentType) {
    case "PURCHASE_ORDER":
      await tx.purchaseOrder.updateMany({ where: { id: documentId, companyId, status: "PENDING_APPROVAL" }, data: { status: "APPROVED" } });
      return;
    case "GOODS_RECEIPT_NOTE":
      await tx.goodsReceiptNote.updateMany({ where: { id: documentId, companyId, status: "PENDING_APPROVAL" }, data: { status: "APPROVED" } });
      return;
    case "SALES_QUOTATION":
      await tx.salesQuotation.updateMany({ where: { id: documentId, companyId, status: "PENDING_APPROVAL" }, data: { status: "APPROVED" } });
      return;
    case "SALES_ORDER":
      await tx.salesOrder.updateMany({ where: { id: documentId, companyId, status: "PENDING_APPROVAL" }, data: { status: "APPROVED" } });
      return;
    case "DELIVERY_CHALLAN":
      await tx.deliveryChallan.updateMany({ where: { id: documentId, companyId, status: "PENDING_APPROVAL" }, data: { status: "APPROVED" } });
      return;
    default:
      return;
  }
}
