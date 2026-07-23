import type { AuditAction } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";
import prisma from "../../lib/prisma";
import type { RequestContext } from "../../types/request-context";

type AuditInput = RequestContext & {
  module: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  description?: string;
  beforeData?: unknown;
  afterData?: unknown;
};

function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAuditLog(input: AuditInput) {
  if (!input.companyId) {
    return;
  }

  await prisma.auditLog.create({
    data: {
      companyId: input.companyId,
      actorUserId: input.userId,
      module: input.module,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      description: input.description,
      beforeData: toJsonInput(input.beforeData),
      afterData: toJsonInput(input.afterData),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  });
}
