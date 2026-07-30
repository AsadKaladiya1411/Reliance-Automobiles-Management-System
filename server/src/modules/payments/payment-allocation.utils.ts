import { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../../utils/api-error";

export type PreparedAllocation = {
  documentType: string;
  documentNumber: string;
  documentId?: string;
  allocatedAmount: Prisma.Decimal;
};

export type OpenSettlementDocument = {
  documentType: string;
  documentNumber: string;
  openAmount: Prisma.Decimal;
};

export function mergePaymentAllocations(allocations: PreparedAllocation[]) {
  const allocationMap = new Map<string, PreparedAllocation>();

  for (const allocation of allocations) {
    const key = `${allocation.documentType}:${allocation.documentNumber}`;
    const existing = allocationMap.get(key);
    allocationMap.set(key, {
      ...allocation,
      allocatedAmount: existing ? existing.allocatedAmount.plus(allocation.allocatedAmount) : allocation.allocatedAmount,
    });
  }

  return [...allocationMap.values()];
}

export function validatePaymentAllocations(
  paymentAmount: Prisma.Decimal,
  allocations: PreparedAllocation[],
  openDocuments: OpenSettlementDocument[],
) {
  const openByDocument = new Map(openDocuments.map((document) => [`${document.documentType}:${document.documentNumber}`, document]));
  const allocatedTotal = allocations.reduce((total, allocation) => total.plus(allocation.allocatedAmount), new Prisma.Decimal(0));

  if (allocatedTotal.gt(paymentAmount)) {
    throw new ApiError(400, "PAYMENT_ALLOCATION_EXCEEDS_PAYMENT", "Allocated amount cannot exceed payment amount.");
  }

  for (const allocation of allocations) {
    const openDocument = openByDocument.get(`${allocation.documentType}:${allocation.documentNumber}`);

    if (!openDocument) {
      throw new ApiError(400, "PAYMENT_ALLOCATION_DOCUMENT_NOT_OPEN", `${allocation.documentNumber} is not open for settlement.`);
    }

    if (allocation.allocatedAmount.gt(openDocument.openAmount)) {
      throw new ApiError(400, "PAYMENT_ALLOCATION_EXCEEDS_OPEN_AMOUNT", `${allocation.documentNumber} allocation exceeds open amount.`);
    }
  }
}
