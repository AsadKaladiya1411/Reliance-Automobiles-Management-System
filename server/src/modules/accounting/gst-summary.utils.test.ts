import assert from "node:assert/strict";
import test from "node:test";
import { calculateGstSummaryFromTotals } from "./gst-summary.utils";

test("GST summary includes workshop billing tax in output tax and net payable", () => {
  const summary = calculateGstSummaryFromTotals({
    purchaseTotals: { cgstAmount: 10, sgstAmount: 10, igstAmount: 0, totalTaxAmount: 20 },
    purchaseReturnTotals: { cgstAmount: 2, sgstAmount: 2, igstAmount: 0, totalTaxAmount: 4 },
    salesTotals: { cgstAmount: 20, sgstAmount: 20, igstAmount: 0, totalTaxAmount: 40 },
    salesReturnTotals: { cgstAmount: 5, sgstAmount: 5, igstAmount: 0, totalTaxAmount: 10 },
    workshopTotals: { billingCgstAmount: 7, billingSgstAmount: 7, billingIgstAmount: 0, billingTotalTaxAmount: 14 },
  });

  assert.equal(summary.inputTax.toString(), "16");
  assert.equal(summary.outputTax.toString(), "44");
  assert.equal(summary.netPayable.toString(), "28");
  assert.equal(summary.outputCgst.toString(), "22");
  assert.equal(summary.outputSgst.toString(), "22");
});
