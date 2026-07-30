import type { ErrorRequestHandler } from "express";
import { env } from "../config/env";
import { isApiError } from "../utils/api-error";
import { sendError } from "../utils/api-response";
import { logger } from "../utils/logger";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (isApiError(error)) {
    logger.warn("API request rejected", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: error.statusCode,
      code: error.code,
      durationMs: req.startedAt ? Date.now() - req.startedAt : undefined,
    });
    sendError(res, error.statusCode, error.code, error.message, error.details);
    return;
  }

  logger.error("Unhandled API error", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    error: error instanceof Error ? error.message : String(error),
    stack: env.nodeEnv === "production" ? undefined : error instanceof Error ? error.stack : undefined,
    durationMs: req.startedAt ? Date.now() - req.startedAt : undefined,
  });

  const message =
    env.nodeEnv === "production"
      ? "Internal Server Error"
      : error instanceof Error
        ? error.message
        : "Internal Server Error";

  sendError(res, 500, "INTERNAL_SERVER_ERROR", message);
};
