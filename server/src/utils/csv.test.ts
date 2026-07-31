import assert from "node:assert/strict";
import test from "node:test";
import { toCsv } from "./csv";

test("CSV export escapes quotes and nullish values", () => {
  const csv = toCsv(["Name", "GSTIN"], [["Umaiza \"Auto\"", null]]);

  assert.equal(csv, "\"Name\",\"GSTIN\"\n\"Umaiza \"\"Auto\"\"\",\"\"");
});
