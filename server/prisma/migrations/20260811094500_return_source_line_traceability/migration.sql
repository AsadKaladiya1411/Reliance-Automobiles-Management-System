-- Keep the source invoice line on every new return line so cumulative returns
-- can be validated exactly. The columns remain nullable for compatibility with
-- any return records created before source-line traceability existed.
ALTER TABLE "PurchaseReturnLine"
ADD COLUMN "purchaseInvoiceLineId" UUID;

ALTER TABLE "SalesReturnLine"
ADD COLUMN "salesInvoiceLineId" UUID;

CREATE INDEX "PurchaseReturnLine_companyId_purchaseInvoiceLineId_idx"
ON "PurchaseReturnLine"("companyId", "purchaseInvoiceLineId");

CREATE UNIQUE INDEX "PurchaseReturnLine_purchaseReturnId_purchaseInvoiceLineId_key"
ON "PurchaseReturnLine"("purchaseReturnId", "purchaseInvoiceLineId");

CREATE INDEX "SalesReturnLine_companyId_salesInvoiceLineId_idx"
ON "SalesReturnLine"("companyId", "salesInvoiceLineId");

CREATE UNIQUE INDEX "SalesReturnLine_salesReturnId_salesInvoiceLineId_key"
ON "SalesReturnLine"("salesReturnId", "salesInvoiceLineId");

ALTER TABLE "PurchaseReturnLine"
ADD CONSTRAINT "PurchaseReturnLine_purchaseInvoiceLineId_fkey"
FOREIGN KEY ("purchaseInvoiceLineId") REFERENCES "PurchaseInvoiceLine"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesReturnLine"
ADD CONSTRAINT "SalesReturnLine_salesInvoiceLineId_fkey"
FOREIGN KEY ("salesInvoiceLineId") REFERENCES "SalesInvoiceLine"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
