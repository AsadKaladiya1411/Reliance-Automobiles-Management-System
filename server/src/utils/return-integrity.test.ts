import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "../generated/prisma/client";
import { ApiError } from "./api-error";
import {
  assertCumulativeReturnQuantity,
  assertUniqueReturnLineIds,
  calculateReturnAmount,
} from "./return-integrity";

test("duplicate invoice lines are rejected within one return", () => {
  assert.throws(
    () => assertUniqueReturnLineIds(["line-1", "line-1"]),
    (error) => error instanceof ApiError && error.code === "DUPLICATE_RETURN_LINE",
  );
});

test("a return cannot exceed the quantity left after posted returns", () => {
  assert.throws(
    () => assertCumulativeReturnQuantity({
      invoiceQuantity: new Prisma.Decimal(5),
      previouslyReturnedQuantity: new Prisma.Decimal(3),
      requestedQuantity: new Prisma.Decimal(3),
    }),
    (error) => error instanceof ApiError
      && error.code === "RETURN_QUANTITY_EXCEEDS_INVOICE"
      && (error.details as { remainingQuantity?: string }).remainingQuantity === "2.000",
  );
});

test("the final return consumes the exact monetary rounding remainder", () => {
  const amount = calculateReturnAmount({
    invoiceAmount: new Prisma.Decimal("100.00"),
    previouslyReturnedAmount: new Prisma.Decimal("66.66"),
    invoiceQuantity: new Prisma.Decimal(3),
    previouslyReturnedQuantity: new Prisma.Decimal(2),
    requestedQuantity: new Prisma.Decimal(1),
  });

  assert.equal(amount.toFixed(2), "33.34");
});
