import { Prisma } from "../generated/prisma/client";
import { ApiError } from "./api-error";

type CumulativeQuantityInput = {
  invoiceQuantity: Prisma.Decimal;
  previouslyReturnedQuantity: Prisma.Decimal;
  requestedQuantity: Prisma.Decimal;
};

type ReturnAmountInput = CumulativeQuantityInput & {
  invoiceAmount: Prisma.Decimal;
  previouslyReturnedAmount: Prisma.Decimal;
};

export function assertUniqueReturnLineIds(invoiceLineIds: string[]) {
  if (new Set(invoiceLineIds).size !== invoiceLineIds.length) {
    throw new ApiError(
      400,
      "DUPLICATE_RETURN_LINE",
      "Each invoice line can appear only once in a return.",
    );
  }
}

export function assertCumulativeReturnQuantity({
  invoiceQuantity,
  previouslyReturnedQuantity,
  requestedQuantity,
}: CumulativeQuantityInput) {
  const remainingQuantity = invoiceQuantity.minus(previouslyReturnedQuantity);
  const availableQuantity = remainingQuantity.lt(0) ? new Prisma.Decimal(0) : remainingQuantity;

  if (remainingQuantity.lte(0) || requestedQuantity.gt(remainingQuantity)) {
    throw new ApiError(
      400,
      "RETURN_QUANTITY_EXCEEDS_INVOICE",
      `Return quantity exceeds the remaining invoice quantity (${availableQuantity.toFixed(3)}).`,
      {
        invoiceQuantity: invoiceQuantity.toFixed(3),
        previouslyReturnedQuantity: previouslyReturnedQuantity.toFixed(3),
        requestedQuantity: requestedQuantity.toFixed(3),
        remainingQuantity: availableQuantity.toFixed(3),
      },
    );
  }
}

export function calculateReturnAmount({
  invoiceAmount,
  previouslyReturnedAmount,
  invoiceQuantity,
  previouslyReturnedQuantity,
  requestedQuantity,
}: ReturnAmountInput) {
  const remainingAmountValue = invoiceAmount.minus(previouslyReturnedAmount);
  const remainingAmount = remainingAmountValue.lt(0) ? new Prisma.Decimal(0) : remainingAmountValue;
  const completesReturn = previouslyReturnedQuantity.plus(requestedQuantity).eq(invoiceQuantity);

  if (completesReturn) {
    return remainingAmount.toDecimalPlaces(2);
  }

  const proportionalAmount = invoiceAmount.mul(requestedQuantity).div(invoiceQuantity).toDecimalPlaces(2);
  return (proportionalAmount.gt(remainingAmount) ? remainingAmount : proportionalAmount).toDecimalPlaces(2);
}
