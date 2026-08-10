import { Router } from "express";
import type { Request } from "express";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { rateLimit } from "../../middleware/rate-limit";
import {
  bootstrapSystem,
  createManagedUser,
  getSetupStatus,
  listRoles,
  listUsers,
  login,
  signAuthToken,
  updateUserRoles,
} from "./auth.service";
import { requireAuth, requireModuleAccess } from "./auth.middleware";

const router = Router();
const authAttemptLimit = rateLimit({ keyPrefix: "auth", windowMs: 15 * 60 * 1000, max: 20 });
const setupAttemptLimit = rateLimit({ keyPrefix: "setup", windowMs: 15 * 60 * 1000, max: 10 });

function requestContext(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}

function requestBody(req: Request) {
  return req.body && typeof req.body === "object"
    ? req.body as Record<string, unknown>
    : {};
}

router.get(
  "/setup/status",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await getSetupStatus());
  }),
);

router.post(
  "/setup/bootstrap",
  setupAttemptLimit,
  asyncHandler(async (req, res) => {
    const { companyName, adminFullName, adminUsername, adminEmail, adminPassword } = requestBody(req);

    if (
      typeof companyName !== "string" || !companyName.trim()
      || typeof adminFullName !== "string" || !adminFullName.trim()
      || typeof adminUsername !== "string" || !adminUsername.trim()
      || typeof adminPassword !== "string" || !adminPassword
      || (adminEmail !== undefined && typeof adminEmail !== "string")
    ) {
      throw new ApiError(
        400,
        "INVALID_BOOTSTRAP_REQUEST",
        "Company name, admin name, username, and password are required.",
      );
    }

    const result = await bootstrapSystem(
      {
        companyName,
        adminFullName,
        adminUsername,
        adminEmail,
        adminPassword,
      },
      requestContext(req),
    );
    const token = signAuthToken(result.user);

    res.cookie(env.cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.nodeEnv === "production",
      maxAge: 8 * 60 * 60 * 1000,
    });

    sendSuccess(res, result, "System setup complete.", 201);
  }),
);

router.post(
  "/auth/login",
  authAttemptLimit,
  asyncHandler(async (req, res) => {
    const { username, password } = requestBody(req);

    if (typeof username !== "string" || !username.trim() || typeof password !== "string" || !password) {
      throw new ApiError(400, "INVALID_LOGIN_REQUEST", "Username and password are required.");
    }

    const user = await login({ username, password }, requestContext(req));
    const token = signAuthToken(user);

    res.cookie(env.cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.nodeEnv === "production",
      maxAge: 8 * 60 * 60 * 1000,
    });

    sendSuccess(res, { user }, "Login successful.");
  }),
);

router.post(
  "/auth/logout",
  asyncHandler(async (_req, res) => {
    res.clearCookie(env.cookieName);
    sendSuccess(res, null, "Logout successful.");
  }),
);

router.get(
  "/auth/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    sendSuccess(res, { user: req.user }, "Authenticated user.");
  }),
);

router.get(
  "/auth/users",
  requireAuth,
  requireModuleAccess("settings"),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await listUsers(req.user!.companyId));
  }),
);

router.post(
  "/auth/users",
  requireAuth,
  requireModuleAccess("settings"),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await createManagedUser(
        {
          companyId: req.user!.companyId,
          userId: req.user!.id,
          roles: req.user!.roles,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        },
        req.body,
      ),
      "User account created.",
      201,
    );
  }),
);

router.get(
  "/auth/roles",
  requireAuth,
  requireModuleAccess("settings"),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await listRoles(req.user!.companyId));
  }),
);

router.patch(
  "/auth/users/:id/roles",
  requireAuth,
  requireModuleAccess("settings"),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await updateUserRoles(
        {
          companyId: req.user!.companyId,
          userId: req.user!.id,
          roles: req.user!.roles,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        },
        String(req.params.id),
        req.body,
      ),
      "User roles updated.",
    );
  }),
);

export default router;
