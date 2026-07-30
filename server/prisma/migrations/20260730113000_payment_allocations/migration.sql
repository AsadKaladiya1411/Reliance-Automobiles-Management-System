CREATE TABLE "PaymentAllocation" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "partyType" "PartyType" NOT NULL,
  "customerId" UUID,
  "supplierId" UUID,
  "documentType" VARCHAR(80) NOT NULL,
  "documentId" VARCHAR(80),
  "documentNumber" VARCHAR(80) NOT NULL,
  "allocatedAmount" DECIMAL(14,2) NOT NULL,
  "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentAllocation_companyId_partyType_documentType_documentNumber_idx" ON "PaymentAllocation"("companyId", "partyType", "documentType", "documentNumber");
CREATE INDEX "PaymentAllocation_companyId_customerId_idx" ON "PaymentAllocation"("companyId", "customerId");
CREATE INDEX "PaymentAllocation_companyId_supplierId_idx" ON "PaymentAllocation"("companyId", "supplierId");
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
