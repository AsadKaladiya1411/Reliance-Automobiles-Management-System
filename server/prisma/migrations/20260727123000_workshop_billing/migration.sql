ALTER TABLE "JobCard" ADD COLUMN "billingNumber" VARCHAR(80);
ALTER TABLE "JobCard" ADD COLUMN "billingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "JobCard" ADD COLUMN "billingJournalEntryId" UUID;
ALTER TABLE "JobCard" ADD COLUMN "billedByUserId" UUID;
ALTER TABLE "JobCard" ADD COLUMN "billedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "JobCard_companyId_billingNumber_key" ON "JobCard"("companyId", "billingNumber");
CREATE INDEX "JobCard_companyId_billedAt_idx" ON "JobCard"("companyId", "billedAt");
