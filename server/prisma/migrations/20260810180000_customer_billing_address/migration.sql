-- Add nullable billing and GST place-of-supply fields without changing existing customer records.
ALTER TABLE "Customer"
ADD COLUMN "addressLine1" VARCHAR(240),
ADD COLUMN "addressLine2" VARCHAR(240),
ADD COLUMN "city" VARCHAR(120),
ADD COLUMN "state" VARCHAR(120),
ADD COLUMN "pincode" VARCHAR(12),
ADD COLUMN "placeOfSupply" VARCHAR(120);
