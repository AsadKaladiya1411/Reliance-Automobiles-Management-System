-- CreateTable
CREATE TABLE "DeliveryChallan" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "salesOrderId" UUID,
    "challanNumber" VARCHAR(80) NOT NULL,
    "challanDate" DATE NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'APPROVED',
    "narration" VARCHAR(500),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryChallan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryChallanLine" (
    "id" UUID NOT NULL,
    "deliveryChallanId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "lineOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DeliveryChallanLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryChallan_companyId_customerId_challanDate_idx" ON "DeliveryChallan"("companyId", "customerId", "challanDate");

-- CreateIndex
CREATE INDEX "DeliveryChallan_companyId_status_challanDate_idx" ON "DeliveryChallan"("companyId", "status", "challanDate");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryChallan_companyId_challanNumber_key" ON "DeliveryChallan"("companyId", "challanNumber");

-- CreateIndex
CREATE INDEX "DeliveryChallanLine_companyId_productVariantId_idx" ON "DeliveryChallanLine"("companyId", "productVariantId");

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanLine" ADD CONSTRAINT "DeliveryChallanLine_deliveryChallanId_fkey" FOREIGN KEY ("deliveryChallanId") REFERENCES "DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanLine" ADD CONSTRAINT "DeliveryChallanLine_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
