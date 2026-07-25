import type { RequestHandler } from "express";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export const requireSameOriginForMutations: RequestHandler = (req, _res, next) => {
  if (safeMethods.has(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");

  if (!origin || origin === env.clientUrl) {
    next();
    return;
  }

  throw new ApiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
};
