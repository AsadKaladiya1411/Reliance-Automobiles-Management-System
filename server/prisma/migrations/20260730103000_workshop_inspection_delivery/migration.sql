ALTER TABLE "JobCard" ADD COLUMN "inspectionChecklist" JSONB;
ALTER TABLE "JobCard" ADD COLUMN "inspectionNotes" VARCHAR(800);
ALTER TABLE "JobCard" ADD COLUMN "qualityCheckedByUserId" UUID;
ALTER TABLE "JobCard" ADD COLUMN "qualityCheckedAt" TIMESTAMP(3);
ALTER TABLE "JobCard" ADD COLUMN "readyAt" TIMESTAMP(3);
ALTER TABLE "JobCard" ADD COLUMN "deliveryNotes" VARCHAR(800);
ALTER TABLE "JobCard" ADD COLUMN "deliveredAt" TIMESTAMP(3);

CREATE INDEX "JobCard_companyId_qualityCheckedAt_idx" ON "JobCard"("companyId", "qualityCheckedAt");
CREATE INDEX "JobCard_companyId_deliveredAt_idx" ON "JobCard"("companyId", "deliveredAt");
