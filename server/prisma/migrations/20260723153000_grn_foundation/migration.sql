-- CreateTable
CREATE TABLE "GoodsReceiptNote" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "purchaseOrderId" UUID,
    "grnNumber" VARCHAR(80) NOT NULL,
    "grnDate" DATE NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'APPROVED',
    "narration" VARCHAR(500),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceiptNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptNoteLine" (
    "id" UUID NOT NULL,
    "goodsReceiptNoteId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "lineOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GoodsReceiptNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoodsReceiptNote_companyId_supplierId_grnDate_idx" ON "GoodsReceiptNote"("companyId", "supplierId", "grnDate");

-- CreateIndex
CREATE INDEX "GoodsReceiptNote_companyId_status_grnDate_idx" ON "GoodsReceiptNote"("companyId", "status", "grnDate");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptNote_companyId_grnNumber_key" ON "GoodsReceiptNote"("companyId", "grnNumber");

-- CreateIndex
CREATE INDEX "GoodsReceiptNoteLine_companyId_productVariantId_idx" ON "GoodsReceiptNoteLine"("companyId", "productVariantId");

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNoteLine" ADD CONSTRAINT "GoodsReceiptNoteLine_goodsReceiptNoteId_fkey" FOREIGN KEY ("goodsReceiptNoteId") REFERENCES "GoodsReceiptNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNoteLine" ADD CONSTRAINT "GoodsReceiptNoteLine_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
