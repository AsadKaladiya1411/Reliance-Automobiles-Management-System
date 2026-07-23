-- CreateTable
CREATE TABLE "FinancialNote" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "partyType" "PartyType" NOT NULL,
    "noteType" "LedgerEntryType" NOT NULL,
    "customerId" UUID,
    "supplierId" UUID,
    "journalEntryId" UUID,
    "noteNumber" VARCHAR(80) NOT NULL,
    "noteDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'POSTED',
    "postedByUserId" UUID,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialNote_companyId_partyType_noteDate_idx" ON "FinancialNote"("companyId", "partyType", "noteDate");

-- CreateIndex
CREATE INDEX "FinancialNote_companyId_noteType_noteDate_idx" ON "FinancialNote"("companyId", "noteType", "noteDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialNote_companyId_noteNumber_key" ON "FinancialNote"("companyId", "noteNumber");

-- AddForeignKey
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialNote" ADD CONSTRAINT "FinancialNote_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
