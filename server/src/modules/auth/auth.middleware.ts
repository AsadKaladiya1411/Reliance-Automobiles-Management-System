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
