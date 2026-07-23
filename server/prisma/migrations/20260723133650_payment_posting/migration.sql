-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "partyType" "PartyType" NOT NULL,
    "customerId" UUID,
    "supplierId" UUID,
    "paymentModeId" UUID NOT NULL,
    "journalEntryId" UUID,
    "paymentNumber" VARCHAR(80) NOT NULL,
    "paymentDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "referenceNo" VARCHAR(120),
    "narration" VARCHAR(500),
    "status" "DocumentStatus" NOT NULL DEFAULT 'POSTED',
    "postedByUserId" UUID,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_companyId_partyType_paymentDate_idx" ON "Payment"("companyId", "partyType", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_companyId_paymentNumber_key" ON "Payment"("companyId", "paymentNumber");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentModeId_fkey" FOREIGN KEY ("paymentModeId") REFERENCES "PaymentMode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
