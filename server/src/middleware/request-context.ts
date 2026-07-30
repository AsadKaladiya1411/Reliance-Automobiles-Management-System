import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const attachRequestContext: RequestHandler = (req, res, next) => {
  const incomingRequestId = req.get("x-request-id")?.trim();
  const requestId = incomingRequestId || randomUUID();
  const startedAt = Date.now();

  req.requestId = requestId;
  req.startedAt = startedAt;
  res.setHeader("x-request-id", requestId);
  res.on("finish", () => {
    req.durationMs = Date.now() - startedAt;
  });

  next();
};
