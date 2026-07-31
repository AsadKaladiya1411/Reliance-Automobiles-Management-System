import type { RequestHandler } from "express";
import { ApiError } from "../utils/api-error";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

export function rateLimit(options: { windowMs: number; max: number; keyPrefix: string }): RequestHandler {
  return (req, _res, next) => {
    const now = Date.now();
    const key = `${options.keyPrefix}:${req.ip ?? "unknown"}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (current.count >= options.max) {
      throw new ApiError(429, "RATE_LIMIT_EXCEEDED", "Too many attempts. Please try again later.");
    }

    current.count += 1;
    next();
  };
}
