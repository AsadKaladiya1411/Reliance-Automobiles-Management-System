import prisma from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import type { RequestContext } from "../../types/request-context";
import { writeAuditLog } from "../audit/audit.service";

type UpdateCompanyInput = {
  name?: string;
  legalName?: string;
  gstin?: string;
  pan?: string;
  tan?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

function clean(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export async function getCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    throw new ApiError(404, "COMPANY_NOT_FOUND", "Company not found.");
  }

  return company;
}

export async function updateCompany(
  companyId: string,
  input: UpdateCompanyInput,
  context: RequestContext,
) {
  const existing = await getCompany(companyId);

  if (input.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(input.gstin)) {
    throw new ApiError(400, "INVALID_GSTIN", "GSTIN format is invalid.");
  }

  if (input.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(input.pan)) {
    throw new ApiError(400, "INVALID_PAN", "PAN format is invalid.");
  }

  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      name: clean(input.name),
      legalName: clean(input.legalName),
      gstin: clean(input.gstin)?.toUpperCase(),
      pan: clean(input.pan)?.toUpperCase(),
      tan: clean(input.tan)?.toUpperCase(),
      phone: clean(input.phone),
      email: clean(input.email)?.toLowerCase(),
      addressLine1: clean(input.addressLine1),
      addressLine2: clean(input.addressLine2),
      city: clean(input.city),
      state: clean(input.state),
      pincode: clean(input.pincode),
    },
  });

  await writeAuditLog({
    ...context,
    companyId,
    module: "company",
    action: "UPDATE",
    entityType: "Company",
    entityId: company.id,
    description: "Company profile updated.",
    beforeData: existing,
    afterData: company,
  });

  return company;
}
