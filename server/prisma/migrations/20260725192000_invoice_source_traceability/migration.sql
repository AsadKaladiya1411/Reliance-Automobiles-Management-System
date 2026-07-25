ALTER TABLE "PurchaseInvoice" ADD COLUMN "goodsReceiptNoteId" UUID;

ALTER TABLE "SalesInvoice" ADD COLUMN "salesOrderId" UUID;
ALTER TABLE "SalesInvoice" ADD COLUMN "deliveryChallanId" UUID;

CREATE INDEX "PurchaseInvoice_companyId_goodsReceiptNoteId_idx" ON "PurchaseInvoice"("companyId", "goodsReceiptNoteId");
CREATE INDEX "SalesInvoice_companyId_salesOrderId_idx" ON "SalesInvoice"("companyId", "salesOrderId");
CREATE INDEX "SalesInvoice_companyId_deliveryChallanId_idx" ON "SalesInvoice"("companyId", "deliveryChallanId");

ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_goodsReceiptNoteId_fkey" FOREIGN KEY ("goodsReceiptNoteId") REFERENCES "GoodsReceiptNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_deliveryChallanId_fkey" FOREIGN KEY ("deliveryChallanId") REFERENCES "DeliveryChallan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
