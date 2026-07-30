CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "ApprovalRule" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "module" VARCHAR(80) NOT NULL,
  "documentType" VARCHAR(80) NOT NULL,
  "triggerAction" VARCHAR(40) NOT NULL DEFAULT 'POST',
  "requireApproval" BOOLEAN NOT NULL DEFAULT false,
  "minimumAmount" DECIMAL(14,2),
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalRequest" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "module" VARCHAR(80) NOT NULL,
  "documentType" VARCHAR(80) NOT NULL,
  "documentId" VARCHAR(80),
  "documentNumber" VARCHAR(80) NOT NULL,
  "requestedAction" VARCHAR(40) NOT NULL DEFAULT 'POST',
  "amount" DECIMAL(14,2),
  "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" VARCHAR(500),
  "decisionNotes" VARCHAR(500),
  "requestedByUserId" UUID,
  "decidedByUserId" UUID,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApprovalRule_companyId_module_documentType_triggerAction_key" ON "ApprovalRule"("companyId", "module", "documentType", "triggerAction");
CREATE INDEX "ApprovalRule_companyId_module_status_idx" ON "ApprovalRule"("companyId", "module", "status");
CREATE INDEX "ApprovalRequest_companyId_module_status_idx" ON "ApprovalRequest"("companyId", "module", "status");
CREATE INDEX "ApprovalRequest_companyId_documentType_documentNumber_idx" ON "ApprovalRequest"("companyId", "documentType", "documentNumber");
CREATE INDEX "ApprovalRequest_companyId_requestedAt_idx" ON "ApprovalRequest"("companyId", "requestedAt");

ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
