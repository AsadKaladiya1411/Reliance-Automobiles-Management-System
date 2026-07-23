import type { ErrorRequestHandler } from "express";
import { env } from "../config/env";
import { isApiError } from "../utils/api-error";
import { sendError } from "../utils/api-response";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (isApiError(error)) {
    sendError(res, error.statusCode, error.code, error.message, error.details);
    return;
  }

  const message =
    env.nodeEnv === "production"
      ? "Internal Server Error"
      : error instanceof Error
        ? error.message
        : "Internal Server Error";

  sendError(res, 500, "INTERNAL_SERVER_ERROR", message);
};
