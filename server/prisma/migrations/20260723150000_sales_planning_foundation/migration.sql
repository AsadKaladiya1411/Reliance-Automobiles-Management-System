-- CreateTable
CREATE TABLE "SalesQuotation" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "quotationNumber" VARCHAR(80) NOT NULL,
    "quotationDate" DATE NOT NULL,
    "validUntil" DATE,
    "taxableAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalTaxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "DocumentStatus" NOT NULL DEFAULT 'APPROVED',
    "narration" VARCHAR(500),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesQuotationLine" (
    "id" UUID NOT NULL,
    "salesQuotationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "taxableAmount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "lineOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SalesQuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "quotationId" UUID,
    "orderNumber" VARCHAR(80) NOT NULL,
    "orderDate" DATE NOT NULL,
    "expectedDate" DATE,
    "taxableAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalTaxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "DocumentStatus" NOT NULL DEFAULT 'APPROVED',
    "narration" VARCHAR(500),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" UUID NOT NULL,
    "salesOrderId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "taxableAmount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "lineOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesQuotation_companyId_customerId_quotationDate_idx" ON "SalesQuotation"("companyId", "customerId", "quotationDate");

-- CreateIndex
CREATE INDEX "SalesQuotation_companyId_status_quotationDate_idx" ON "SalesQuotation"("companyId", "status", "quotationDate");

-- CreateIndex
CREATE UNIQUE INDEX "SalesQuotation_companyId_quotationNumber_key" ON "SalesQuotation"("companyId", "quotationNumber");

-- CreateIndex
CREATE INDEX "SalesQuotationLine_companyId_productVariantId_idx" ON "SalesQuotationLine"("companyId", "productVariantId");

-- CreateIndex
CREATE INDEX "SalesOrder_companyId_customerId_orderDate_idx" ON "SalesOrder"("companyId", "customerId", "orderDate");

-- CreateIndex
CREATE INDEX "SalesOrder_companyId_status_orderDate_idx" ON "SalesOrder"("companyId", "status", "orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_companyId_orderNumber_key" ON "SalesOrder"("companyId", "orderNumber");

-- CreateIndex
CREATE INDEX "SalesOrderLine_companyId_productVariantId_idx" ON "SalesOrderLine"("companyId", "productVariantId");

-- AddForeignKey
ALTER TABLE "SalesQuotation" ADD CONSTRAINT "SalesQuotation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuotation" ADD CONSTRAINT "SalesQuotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuotationLine" ADD CONSTRAINT "SalesQuotationLine_salesQuotationId_fkey" FOREIGN KEY ("salesQuotationId") REFERENCES "SalesQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuotationLine" ADD CONSTRAINT "SalesQuotationLine_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SalesQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
