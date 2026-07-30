import assert from "node:assert/strict";
import test from "node:test";
import { formatDocumentNumber } from "./number-series.utils";

test("document numbers apply prefix, padding, and suffix consistently", () => {
  const number = formatDocumentNumber({
    prefix: "SI-",
    suffix: "-26",
    padding: 5,
    nextNumber: 42,
  });

  assert.equal(number, "SI-00042-26");
});

test("document numbers preserve unpadded values longer than configured padding", () => {
  const number = formatDocumentNumber({
    prefix: "PO-",
    suffix: "",
    padding: 2,
    nextNumber: 1234,
  });

  assert.equal(number, "PO-1234");
});
