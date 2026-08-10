import assert from "node:assert/strict";
import test from "node:test";
import { removesLastSuperAdmin } from "./user-access-policy";

test("the only active Super Admin cannot lose that role", () => {
  assert.equal(removesLastSuperAdmin({
    currentlySuperAdmin: true,
    nextRoleCodes: ["STAFF"],
    otherActiveSuperAdminCount: 0,
  }), true);
});

test("a Super Admin role can be changed when another active administrator remains", () => {
  assert.equal(removesLastSuperAdmin({
    currentlySuperAdmin: true,
    nextRoleCodes: ["STAFF"],
    otherActiveSuperAdminCount: 1,
  }), false);
});

test("ordinary role changes do not trigger the last-admin guard", () => {
  assert.equal(removesLastSuperAdmin({
    currentlySuperAdmin: false,
    nextRoleCodes: ["STAFF"],
    otherActiveSuperAdminCount: 0,
  }), false);
});
