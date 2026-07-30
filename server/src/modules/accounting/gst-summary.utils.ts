import { Prisma } from "../../generated/prisma/client";

type DecimalInput = string | number | Prisma.Decimal;

export type GstTaxTotals = {
  cgstAmount?: DecimalInput | null;
  sgstAmount?: DecimalInput | null;
  igstAmount?: DecimalInput | null;
  totalTaxAmount?: DecimalInput | null;
};

export type WorkshopGstTaxTotals = {
  billingCgstAmount?: DecimalInput | null;
  billingSgstAmount?: DecimalInput | null;
  billingIgstAmount?: DecimalInput | null;
  billingTotalTaxAmount?: DecimalInput | null;
};

export function calculateGstSummaryFromTotals(input: {
  purchaseTotals: GstTaxTotals;
  purchaseReturnTotals: GstTaxTotals;
  salesTotals: GstTaxTotals;
  salesReturnTotals: GstTaxTotals;
  workshopTotals: WorkshopGstTaxTotals;
}) {
  const inputCgst = new Prisma.Decimal(input.purchaseTotals.cgstAmount ?? 0).minus(input.purchaseReturnTotals.cgstAmount ?? 0);
  const inputSgst = new Prisma.Decimal(input.purchaseTotals.sgstAmount ?? 0).minus(input.purchaseReturnTotals.sgstAmount ?? 0);
  const inputIgst = new Prisma.Decimal(input.purchaseTotals.igstAmount ?? 0).minus(input.purchaseReturnTotals.igstAmount ?? 0);
  const outputCgst = new Prisma.Decimal(input.salesTotals.cgstAmount ?? 0)
    .plus(input.workshopTotals.billingCgstAmount ?? 0)
    .minus(input.salesReturnTotals.cgstAmount ?? 0);
  const outputSgst = new Prisma.Decimal(input.salesTotals.sgstAmount ?? 0)
    .plus(input.workshopTotals.billingSgstAmount ?? 0)
    .minus(input.salesReturnTotals.sgstAmount ?? 0);
  const outputIgst = new Prisma.Decimal(input.salesTotals.igstAmount ?? 0)
    .plus(input.workshopTotals.billingIgstAmount ?? 0)
    .minus(input.salesReturnTotals.igstAmount ?? 0);
  const inputTax = new Prisma.Decimal(input.purchaseTotals.totalTaxAmount ?? 0).minus(input.purchaseReturnTotals.totalTaxAmount ?? 0);
  const outputTax = new Prisma.Decimal(input.salesTotals.totalTaxAmount ?? 0)
    .plus(input.workshopTotals.billingTotalTaxAmount ?? 0)
    .minus(input.salesReturnTotals.totalTaxAmount ?? 0);

  return {
    inputCgst,
    inputSgst,
    inputIgst,
    outputCgst,
    outputSgst,
    outputIgst,
    inputTax,
    outputTax,
    netPayable: outputTax.minus(inputTax),
  };
}
