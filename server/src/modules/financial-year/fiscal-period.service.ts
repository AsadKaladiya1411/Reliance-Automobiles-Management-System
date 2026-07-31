import type { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../../utils/api-error";

export async function requireOpenFinancialYear(
  tx: Prisma.TransactionClient,
  companyId: string,
  postingDate: Date,
) {
  const financialYear = await tx.financialYear.findFirst({
    where: {
      companyId,
      status: "OPEN",
      startDate: { lte: postingDate },
      endDate: { gte: postingDate },
    },
  });

  if (!financialYear) {
    throw new ApiError(400, "FINANCIAL_YEAR_NOT_OPEN", "Posting date must fall within an open financial year.");
  }

  return financialYear;
}
