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

  const existing = await prisma.approvalRequest.findFirst({ where: { id: requestId, companyId: context.companyId } });
  if (!existing) {
    throw new ApiError(404, "APPROVAL_REQUEST_NOT_FOUND", "Approval request not found.");
  }

  if (existing.status !== "PENDING") {
    throw new ApiError(400, "APPROVAL_REQUEST_CLOSED", "Only pending approval requests can be decided.");
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: existing.id },
    data: {
      status: decision as "APPROVED" | "REJECTED",
      decisionNotes: optionalString(data.decisionNotes),
      decidedByUserId: context.userId,
      decidedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
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
}
