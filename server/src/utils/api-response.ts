import type { Response } from "express";

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "OK",
  statusCode = 200,
) {
  return res.status(statusCode).json({
    success: true,
    message,
    requestId: res.req.requestId,
    data,
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return res.status(statusCode).json({
    success: false,
    requestId: res.req.requestId,
    error: {
      code,
      message,
      details,
    },
  });
}
