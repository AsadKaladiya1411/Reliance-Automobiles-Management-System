import assert from "node:assert/strict";
import test from "node:test";
import { validateJwtSecret } from "./security-config";

test("production rejects documented and development JWT secrets", () => {
  for (const secret of [
    "development-only-change-before-production",
    "change-this-before-production",
    "replace-with-a-long-random-secret",
  ]) {
    assert.throws(() => validateJwtSecret(secret, "production"), /unique random value/);
  }
});

test("production rejects short JWT secrets and accepts a strong random secret", () => {
  assert.throws(() => validateJwtSecret("too-short", "production"), /unique random value/);
  assert.equal(
    validateJwtSecret("W0VzaWduZWRfdGVzdF9zZWNyZXRfNDhfYnl0ZXNfbG9uZw", "production"),
    "W0VzaWduZWRfdGVzdF9zZWNyZXRfNDhfYnl0ZXNfbG9uZw",
  );
});

test("development can use the documented local fallback", () => {
  assert.equal(
    validateJwtSecret("development-only-change-before-production", "development"),
    "development-only-change-before-production",
  );
});
