import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../../utils/api-error";
import { mergePaymentAllocations, validatePaymentAllocations } from "./payment-allocation.utils";

test("payment allocations are merged by document before validation", () => {
  const merged = mergePaymentAllocations([
    { documentType: "SALES_INVOICE", documentNumber: "SI-001", allocatedAmount: new Prisma.Decimal(40) },
    { documentType: "SALES_INVOICE", documentNumber: "SI-001", allocatedAmount: new Prisma.Decimal(60) },
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.allocatedAmount.toString(), "100");
});

test("payment allocation validation rejects totals above payment amount", () => {
  assert.throws(
    () => validatePaymentAllocations(
      new Prisma.Decimal(99),
      [{ documentType: "SALES_INVOICE", documentNumber: "SI-001", allocatedAmount: new Prisma.Decimal(100) }],
      [{ documentType: "SALES_INVOICE", documentNumber: "SI-001", openAmount: new Prisma.Decimal(100) }],
    ),
    (error) => error instanceof ApiError && error.code === "PAYMENT_ALLOCATION_EXCEEDS_PAYMENT",
  );
});

test("payment allocation validation rejects closed documents", () => {
  assert.throws(
    () => validatePaymentAllocations(
      new Prisma.Decimal(50),
      [{ documentType: "SALES_INVOICE", documentNumber: "SI-002", allocatedAmount: new Prisma.Decimal(50) }],
      [{ documentType: "SALES_INVOICE", documentNumber: "SI-001", openAmount: new Prisma.Decimal(100) }],
    ),
    (error) => error instanceof ApiError && error.code === "PAYMENT_ALLOCATION_DOCUMENT_NOT_OPEN",
  );
});
