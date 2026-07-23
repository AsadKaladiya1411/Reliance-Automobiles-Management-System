import { Router } from "express";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";

const router = Router();

router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;

    sendSuccess(res, {
      service: "RAMS API",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  }),
);

router.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const [companyCount, openFinancialYears, numberSeriesCount, userCount] = await Promise.all([
      prisma.company.count(),
      prisma.financialYear.count({ where: { status: "OPEN" } }),
      prisma.numberSeries.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "ACTIVE" } }),
    ]);

    sendSuccess(res, {
      service: "RAMS API",
      companyConfigured: companyCount > 0,
      openFinancialYears,
      numberSeriesCount,
      activeUsers: userCount,
      timestamp: new Date().toISOString(),
    });
  }),
);

export default router;
