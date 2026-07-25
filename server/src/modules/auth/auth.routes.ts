import { Router } from "express";
import type { Request } from "express";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import {
  bootstrapSystem,
  getSetupStatus,
  listRoles,
  listUsers,
  login,
  registerUser,
  signAuthToken,
  updateUserRoles,
} from "./auth.service";
import { requireAuth } from "./auth.middleware";

const router = Router();

function requestContext(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}

router.get(
  "/setup/status",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await getSetupStatus());
  }),
);

router.post(
  "/setup/bootstrap",
  asyncHandler(async (req, res) => {
    const { companyName, adminFullName, adminUsername, adminEmail, adminPassword } = req.body;

    if (!companyName || !adminFullName || !adminUsername || !adminPassword) {
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
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
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
  "/auth/register",
  asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      throw new ApiError(400, "INVALID_REGISTER_REQUEST", "Username, email, and password are required.");
    }

    const user = await registerUser({ username, email, password }, requestContext(req));
    const token = signAuthToken(user);

    res.cookie(env.cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.nodeEnv === "production",
      maxAge: 8 * 60 * 60 * 1000,
    });

    sendSuccess(res, { user }, "Registration successful.", 201);
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
  asyncHandler(async (req, res) => {
    sendSuccess(res, await listUsers(req.user!.companyId));
  }),
);

router.get(
  "/auth/roles",
  requireAuth,
  asyncHandler(async (req, res) => {
    sendSuccess(res, await listRoles(req.user!.companyId));
  }),
);

router.patch(
  "/auth/users/:id/roles",
  requireAuth,
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
