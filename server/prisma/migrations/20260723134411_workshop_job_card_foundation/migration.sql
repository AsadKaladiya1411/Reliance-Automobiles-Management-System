-- CreateEnum
CREATE TYPE "JobCardStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "JobCard" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "advisorEmployeeId" UUID,
    "technicianEmployeeId" UUID,
    "jobCardNumber" VARCHAR(80) NOT NULL,
    "jobDate" DATE NOT NULL,
    "expectedDeliveryAt" TIMESTAMP(3),
    "odometerReading" INTEGER NOT NULL DEFAULT 0,
    "fuelLevel" VARCHAR(40),
    "complaint" VARCHAR(800) NOT NULL,
    "diagnosis" VARCHAR(800),
    "workNotes" VARCHAR(800),
    "status" "JobCardStatus" NOT NULL DEFAULT 'OPEN',
    "estimatedPartsTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estimatedLaborTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estimatedTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobCardPart" (
    "id" UUID NOT NULL,
    "jobCardId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "estimatedRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estimatedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobCardPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobCardLabor" (
    "id" UUID NOT NULL,
    "jobCardId" UUID NOT NULL,
    "description" VARCHAR(240) NOT NULL,
    "estimatedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobCardLabor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobCard_companyId_status_jobDate_idx" ON "JobCard"("companyId", "status", "jobDate");

-- CreateIndex
CREATE INDEX "JobCard_companyId_customerId_jobDate_idx" ON "JobCard"("companyId", "customerId", "jobDate");

-- CreateIndex
CREATE INDEX "JobCard_companyId_vehicleId_jobDate_idx" ON "JobCard"("companyId", "vehicleId", "jobDate");

-- CreateIndex
CREATE UNIQUE INDEX "JobCard_companyId_jobCardNumber_key" ON "JobCard"("companyId", "jobCardNumber");

-- CreateIndex
CREATE INDEX "JobCardPart_jobCardId_idx" ON "JobCardPart"("jobCardId");

-- CreateIndex
CREATE INDEX "JobCardLabor_jobCardId_idx" ON "JobCardLabor"("jobCardId");

-- AddForeignKey
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_advisorEmployeeId_fkey" FOREIGN KEY ("advisorEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_technicianEmployeeId_fkey" FOREIGN KEY ("technicianEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCardPart" ADD CONSTRAINT "JobCardPart_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCardPart" ADD CONSTRAINT "JobCardPart_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCardLabor" ADD CONSTRAINT "JobCardLabor_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
