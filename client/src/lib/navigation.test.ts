import assert from "node:assert/strict";
import test from "node:test";
import { canAccessView, navItems, viewPermissions, type AppView } from "./navigation";

test("every navigation item has an explicit permission policy", () => {
  const navIds = navItems.map((item) => item.id).sort();
  const policyIds = Object.keys(viewPermissions).sort();

  assert.deepEqual(policyIds, navIds);
});

test("super admin can access every frontend view", () => {
  const user = { roles: ["SUPER_ADMIN"], permissions: [] };

  for (const item of navItems) {
    assert.equal(canAccessView(user, item.id), true, item.id);
  }
});

test("staff navigation is restricted by assigned read permissions", () => {
  const user = {
    roles: ["STAFF"],
    permissions: ["dashboard:read", "masters:read", "inventory:read"],
  };
  const visibleViews = navItems.filter((item) => canAccessView(user, item.id)).map((item) => item.id);

  assert.deepEqual(visibleViews, ["dashboard", "masters", "inventory"] satisfies AppView[]);
  assert.equal(canAccessView(user, "settings"), false);
  assert.equal(canAccessView(user, "transactions"), false);
});

test("transaction and reports views allow any relevant module read permission", () => {
  assert.equal(canAccessView({ roles: ["STAFF"], permissions: ["sales:read"] }, "transactions"), true);
  assert.equal(canAccessView({ roles: ["STAFF"], permissions: ["gst:read"] }, "reports"), true);
  assert.equal(canAccessView({ roles: ["STAFF"], permissions: ["workshop:read"] }, "reports"), false);
});
