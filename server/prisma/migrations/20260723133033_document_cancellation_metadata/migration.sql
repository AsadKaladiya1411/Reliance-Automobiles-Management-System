-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "cancellationReason" VARCHAR(500),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByUserId" UUID;

-- AlterTable
ALTER TABLE "SalesInvoice" ADD COLUMN     "cancellationReason" VARCHAR(500),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByUserId" UUID;
