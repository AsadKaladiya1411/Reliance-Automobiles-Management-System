ALTER TABLE "JobCard" ADD COLUMN "technicianStatus" VARCHAR(40) NOT NULL DEFAULT 'PENDING';
ALTER TABLE "JobCard" ADD COLUMN "technicianNotes" VARCHAR(800);
ALTER TABLE "JobCard" ADD COLUMN "technicianStartedAt" TIMESTAMP(3);
ALTER TABLE "JobCard" ADD COLUMN "technicianCompletedAt" TIMESTAMP(3);

CREATE INDEX "JobCard_companyId_technicianEmployeeId_technicianStatus_idx" ON "JobCard"("companyId", "technicianEmployeeId", "technicianStatus");
