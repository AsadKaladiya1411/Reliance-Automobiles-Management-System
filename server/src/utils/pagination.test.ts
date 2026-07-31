import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "./api-error";
import { pagedResult, parsePageQuery } from "./pagination";

test("pagination query applies defaults and skip/take values", () => {
  const query = parsePageQuery({ search: "brake", page: "3", pageSize: "20" });

  assert.equal(query.search, "brake");
  assert.equal(query.page, 3);
  assert.equal(query.pageSize, 20);
  assert.equal(query.skip, 40);
  assert.equal(query.take, 20);
});

test("pagination caps page size at 100", () => {
  const query = parsePageQuery({ pageSize: "500" });

  assert.equal(query.pageSize, 100);
  assert.equal(query.take, 100);
});

test("pagination rejects invalid values", () => {
  assert.throws(
    () => parsePageQuery({ page: "0" }),
    (error) => error instanceof ApiError && error.code === "INVALID_PAGINATION",
  );
});

test("paged result returns total page count", () => {
  const query = parsePageQuery({ page: "2", pageSize: "10" });
  const result = pagedResult([{ id: 1 }], 26, query);

  assert.equal(result.pageCount, 3);
});
