import assert from "node:assert/strict";
import test from "node:test";

type RouterLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: unknown[];
  };
};

test("user onboarding has no public registration route and keeps managed creation behind middleware", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/rams_test";
  process.env.NODE_ENV = "test";

  const router = (require("./auth.routes") as { default: unknown }).default as { stack: RouterLayer[] };
  const routes = router.stack.flatMap((layer) => (layer.route ? [layer.route] : []));

  assert.equal(routes.some((route) => route.path === "/auth/register"), false);

  const managedUserRoute = routes.find(
    (route) => route.path === "/auth/users" && route.methods.post,
  );

  assert.ok(managedUserRoute, "POST /auth/users must exist for controlled onboarding");
  assert.ok(
    managedUserRoute.stack.length >= 3,
    "managed user creation must include authentication and authorization middleware",
  );
});
