-- AlterTable
ALTER TABLE "JobCard" ADD COLUMN "partsIssueWarehouseId" UUID,
ADD COLUMN "partsIssueJournalEntryId" UUID,
ADD COLUMN "partsIssuedByUserId" UUID,
ADD COLUMN "partsIssuedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "JobCard_companyId_partsIssuedAt_idx" ON "JobCard"("companyId", "partsIssuedAt");
