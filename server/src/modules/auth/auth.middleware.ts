import type { RequestHandler } from "express";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { getUserById, verifyAuthToken } from "./auth.service";

export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const bearerToken = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice("Bearer ".length)
    : undefined;
  const token = req.cookies?.[env.cookieName] || bearerToken;

  if (!token) {
    throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication required.");
  }

  const payload = verifyAuthToken(token);
  req.user = await getUserById(payload.sub);
  next();
});

function hasPermission(permissions: string[], module: string, action: string) {
  return permissions.includes(`${module}:${action}`);
}

function actionsForMethod(method: string) {
  if (method === "GET") {
    return ["read"];
  }
  if (method === "PATCH" || method === "PUT") {
    return ["update"];
  }
  if (method === "DELETE") {
    return ["delete"];
  }
  if (method === "POST") {
    return ["create", "post", "approve", "update"];
  }

  return ["read"];
}

export function requireModuleAccess(module: string): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;

    if (!user) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication required.");
    }

    if (user.roles.includes("SUPER_ADMIN")) {
      next();
      return;
    }

    const allowed = actionsForMethod(req.method).some((action) => hasPermission(user.permissions, module, action));

    if (!allowed) {
      throw new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action.");
    }

    next();
  };
}

export function requirePermission(module: string, action: string): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;

    if (!user) {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication required.");
    }

    if (user.roles.includes("SUPER_ADMIN") || hasPermission(user.permissions, module, action)) {
      next();
      return;
    }

    throw new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action.");
  };
}
