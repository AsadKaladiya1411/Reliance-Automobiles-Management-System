import prisma from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import type { RequestContext } from "../../types/request-context";
import { writeAuditLog } from "../audit/audit.service";

type CommercialContext = RequestContext & {
  companyId: string;
  userId: string;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_COMMERCIAL_MASTER", `${field} is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function nonNegativeNumber(value: unknown, fallback = 0) {
  const number = value === undefined || value === null || value === "" ? fallback : Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new ApiError(400, "INVALID_NUMBER", "Numeric values must be non-negative.");
  }

  return number;
}

function nonNegativeInteger(value: unknown, field: string, fallback = 0) {
  const number = nonNegativeNumber(value, fallback);

  if (!Number.isInteger(number)) {
    throw new ApiError(400, "INVALID_INTEGER", `${field} must be a whole number.`);
  }

  return number;
}

function optionalDate(value: unknown) {
  if (!value) {
    return undefined;
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "INVALID_DATE", "Date is invalid.");
  }

  return date;
}

async function auditCreate(context: CommercialContext, entityType: string, entityId: string, data: unknown) {
  await writeAuditLog({
    ...context,
    module: "commercial-masters",
    action: "CREATE",
    entityType,
    entityId,
    description: `${entityType} created.`,
    afterData: data,
  });
}

async function auditUpdate(context: CommercialContext, entityType: string, entityId: string, beforeData: unknown, afterData: unknown) {
  await writeAuditLog({
    ...context,
    module: "commercial-masters",
    action: "UPDATE",
    entityType,
    entityId,
    description: `${entityType} updated.`,
    beforeData,
    afterData,
  });
}

async function auditDeactivate(context: CommercialContext, entityType: string, entityId: string, beforeData: unknown, afterData: unknown) {
  await writeAuditLog({
    ...context,
    module: "commercial-masters",
    action: "DELETE",
    entityType,
    entityId,
    description: `${entityType} deactivated.`,
    beforeData,
    afterData,
  });
}

export async function getCommercialMasterSummary(companyId: string) {
  const [customers, suppliers, employees, vehicles, paymentModes] = await Promise.all([
    prisma.customer.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.supplier.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.employee.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.vehicle.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.paymentMode.count({ where: { companyId, status: "ACTIVE" } }),
  ]);

  return { customers, suppliers, employees, vehicles, paymentModes };
}

export async function listCustomers(companyId: string) {
  return prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}

export async function createCustomer(context: CommercialContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const customer = await prisma.customer.create({
    data: {
      companyId: context.companyId,
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      customerType: optionalString(data.customerType) ?? "Retail",
      phone: optionalString(data.phone),
      email: optionalString(data.email)?.toLowerCase(),
      gstin: optionalString(data.gstin)?.toUpperCase(),
      pan: optionalString(data.pan)?.toUpperCase(),
      creditLimit: nonNegativeNumber(data.creditLimit),
      creditDays: nonNegativeInteger(data.creditDays, "Credit days"),
    },
  });
  await auditCreate(context, "Customer", customer.id, customer);
  return customer;
}

export async function updateCustomer(context: CommercialContext, customerId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.customer.findFirst({ where: { id: customerId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  }

  const updated = await prisma.customer.update({
    where: { id: existing.id },
    data: {
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      customerType: optionalString(data.customerType) ?? "Retail",
      phone: optionalString(data.phone),
      email: optionalString(data.email)?.toLowerCase(),
      gstin: optionalString(data.gstin)?.toUpperCase(),
      pan: optionalString(data.pan)?.toUpperCase(),
      creditLimit: nonNegativeNumber(data.creditLimit),
      creditDays: nonNegativeInteger(data.creditDays, "Credit days"),
    },
  });
  await auditUpdate(context, "Customer", updated.id, existing, updated);
  return updated;
}

export async function deactivateCustomer(context: CommercialContext, customerId: string) {
  const existing = await prisma.customer.findFirst({ where: { id: customerId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  }

  const [ledger, quotations, orders, challans, invoices, returns, payments, notes, jobCards, vehicles] = await Promise.all([
    prisma.partyLedgerEntry.count({ where: { companyId: context.companyId, customerId } }),
    prisma.salesQuotation.count({ where: { companyId: context.companyId, customerId } }),
    prisma.salesOrder.count({ where: { companyId: context.companyId, customerId } }),
    prisma.deliveryChallan.count({ where: { companyId: context.companyId, customerId } }),
    prisma.salesInvoice.count({ where: { companyId: context.companyId, customerId } }),
    prisma.salesReturn.count({ where: { companyId: context.companyId, customerId } }),
    prisma.payment.count({ where: { companyId: context.companyId, customerId } }),
    prisma.financialNote.count({ where: { companyId: context.companyId, customerId } }),
    prisma.jobCard.count({ where: { companyId: context.companyId, customerId } }),
    prisma.vehicle.count({ where: { companyId: context.companyId, customerId } }),
  ]);

  if ([ledger, quotations, orders, challans, invoices, returns, payments, notes, jobCards, vehicles].some((count) => count > 0)) {
    throw new ApiError(400, "MASTER_IN_USE", "Customer has business activity and cannot be deactivated.");
  }

  const updated = await prisma.customer.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "Customer", updated.id, existing, updated);
  return updated;
}

export async function listSuppliers(companyId: string) {
  return prisma.supplier.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}

export async function createSupplier(context: CommercialContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const supplier = await prisma.supplier.create({
    data: {
      companyId: context.companyId,
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      supplierType: optionalString(data.supplierType) ?? "Distributor",
      phone: optionalString(data.phone),
      email: optionalString(data.email)?.toLowerCase(),
      gstin: optionalString(data.gstin)?.toUpperCase(),
      pan: optionalString(data.pan)?.toUpperCase(),
      creditDays: nonNegativeInteger(data.creditDays, "Credit days"),
    },
  });
  await auditCreate(context, "Supplier", supplier.id, supplier);
  return supplier;
}

export async function updateSupplier(context: CommercialContext, supplierId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.supplier.findFirst({ where: { id: supplierId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
  }

  const updated = await prisma.supplier.update({
    where: { id: existing.id },
    data: {
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      supplierType: optionalString(data.supplierType) ?? "Distributor",
      phone: optionalString(data.phone),
      email: optionalString(data.email)?.toLowerCase(),
      gstin: optionalString(data.gstin)?.toUpperCase(),
      pan: optionalString(data.pan)?.toUpperCase(),
      creditDays: nonNegativeInteger(data.creditDays, "Credit days"),
    },
  });
  await auditUpdate(context, "Supplier", updated.id, existing, updated);
  return updated;
}

export async function deactivateSupplier(context: CommercialContext, supplierId: string) {
  const existing = await prisma.supplier.findFirst({ where: { id: supplierId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
  }

  const [ledger, orders, grns, invoices, returns, payments, notes] = await Promise.all([
    prisma.partyLedgerEntry.count({ where: { companyId: context.companyId, supplierId } }),
    prisma.purchaseOrder.count({ where: { companyId: context.companyId, supplierId } }),
    prisma.goodsReceiptNote.count({ where: { companyId: context.companyId, supplierId } }),
    prisma.purchaseInvoice.count({ where: { companyId: context.companyId, supplierId } }),
    prisma.purchaseReturn.count({ where: { companyId: context.companyId, supplierId } }),
    prisma.payment.count({ where: { companyId: context.companyId, supplierId } }),
    prisma.financialNote.count({ where: { companyId: context.companyId, supplierId } }),
  ]);

  if ([ledger, orders, grns, invoices, returns, payments, notes].some((count) => count > 0)) {
    throw new ApiError(400, "MASTER_IN_USE", "Supplier has business activity and cannot be deactivated.");
  }

  const updated = await prisma.supplier.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "Supplier", updated.id, existing, updated);
  return updated;
}

export async function listEmployees(companyId: string) {
  return prisma.employee.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}

export async function createEmployee(context: CommercialContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const employee = await prisma.employee.create({
    data: {
      companyId: context.companyId,
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      designation: optionalString(data.designation),
      department: optionalString(data.department),
      phone: optionalString(data.phone),
      email: optionalString(data.email)?.toLowerCase(),
      joiningDate: optionalDate(data.joiningDate),
    },
  });
  await auditCreate(context, "Employee", employee.id, employee);
  return employee;
}

export async function updateEmployee(context: CommercialContext, employeeId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.employee.findFirst({ where: { id: employeeId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  const updated = await prisma.employee.update({
    where: { id: existing.id },
    data: {
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      designation: optionalString(data.designation),
      department: optionalString(data.department),
      phone: optionalString(data.phone),
      email: optionalString(data.email)?.toLowerCase(),
      joiningDate: optionalDate(data.joiningDate),
    },
  });
  await auditUpdate(context, "Employee", updated.id, existing, updated);
  return updated;
}

export async function deactivateEmployee(context: CommercialContext, employeeId: string) {
  const existing = await prisma.employee.findFirst({ where: { id: employeeId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  const jobCards = await prisma.jobCard.count({
    where: {
      companyId: context.companyId,
      OR: [{ advisorEmployeeId: employeeId }, { technicianEmployeeId: employeeId }],
    },
  });

  if (jobCards > 0) {
    throw new ApiError(400, "MASTER_IN_USE", "Employee is assigned to job cards and cannot be deactivated.");
  }

  const updated = await prisma.employee.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "Employee", updated.id, existing, updated);
  return updated;
}

export async function listVehicles(companyId: string) {
  return prisma.vehicle.findMany({
    where: { companyId },
    include: { customer: true },
    orderBy: { registrationNumber: "asc" },
  });
}

export async function createVehicle(context: CommercialContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const customerId = optionalString(data.customerId);

  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId: context.companyId, status: "ACTIVE" },
    });

    if (!customer) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found or inactive.");
    }
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      companyId: context.companyId,
      customerId,
      registrationNumber: requiredString(data.registrationNumber, "Registration number").toUpperCase(),
      chassisNumber: optionalString(data.chassisNumber)?.toUpperCase(),
      engineNumber: optionalString(data.engineNumber)?.toUpperCase(),
      vehicleType: optionalString(data.vehicleType) ?? "Four-wheeler",
      brand: requiredString(data.brand, "Brand"),
      model: requiredString(data.model, "Model"),
      variant: optionalString(data.variant),
      fuelType: optionalString(data.fuelType),
      odometerReading: nonNegativeInteger(data.odometerReading, "Odometer reading"),
    },
  });
  await auditCreate(context, "Vehicle", vehicle.id, vehicle);
  return vehicle;
}

export async function updateVehicle(context: CommercialContext, vehicleId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.vehicle.findFirst({ where: { id: vehicleId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  }

  const customerId = optionalString(data.customerId);

  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId: context.companyId, status: "ACTIVE" },
    });

    if (!customer) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found or inactive.");
    }
  }

  const updated = await prisma.vehicle.update({
    where: { id: existing.id },
    data: {
      customerId,
      registrationNumber: requiredString(data.registrationNumber, "Registration number").toUpperCase(),
      chassisNumber: optionalString(data.chassisNumber)?.toUpperCase(),
      engineNumber: optionalString(data.engineNumber)?.toUpperCase(),
      vehicleType: optionalString(data.vehicleType) ?? "Four-wheeler",
      brand: requiredString(data.brand, "Brand"),
      model: requiredString(data.model, "Model"),
      variant: optionalString(data.variant),
      fuelType: optionalString(data.fuelType),
      odometerReading: nonNegativeInteger(data.odometerReading, "Odometer reading"),
    },
  });
  await auditUpdate(context, "Vehicle", updated.id, existing, updated);
  return updated;
}

export async function deactivateVehicle(context: CommercialContext, vehicleId: string) {
  const existing = await prisma.vehicle.findFirst({ where: { id: vehicleId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  }

  const jobCards = await prisma.jobCard.count({ where: { companyId: context.companyId, vehicleId } });

  if (jobCards > 0) {
    throw new ApiError(400, "MASTER_IN_USE", "Vehicle is used by job cards and cannot be deactivated.");
  }

  const updated = await prisma.vehicle.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "Vehicle", updated.id, existing, updated);
  return updated;
}

export async function listPaymentModes(companyId: string) {
  return prisma.paymentMode.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}

export async function createPaymentMode(context: CommercialContext, body: unknown) {
  const data = body as Record<string, unknown>;
  const paymentMode = await prisma.paymentMode.create({
    data: {
      companyId: context.companyId,
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      paymentType: requiredString(data.paymentType, "Payment type"),
      requiresReference: Boolean(data.requiresReference),
      isDefault: Boolean(data.isDefault),
    },
  });
  await auditCreate(context, "PaymentMode", paymentMode.id, paymentMode);
  return paymentMode;
}

export async function updatePaymentMode(context: CommercialContext, paymentModeId: string, body: unknown) {
  const data = body as Record<string, unknown>;
  const existing = await prisma.paymentMode.findFirst({ where: { id: paymentModeId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "PAYMENT_MODE_NOT_FOUND", "Payment mode not found.");
  }

  const updated = await prisma.paymentMode.update({
    where: { id: existing.id },
    data: {
      code: requiredString(data.code, "Code").toUpperCase(),
      name: requiredString(data.name, "Name"),
      paymentType: requiredString(data.paymentType, "Payment type"),
      requiresReference: Boolean(data.requiresReference),
      isDefault: Boolean(data.isDefault),
    },
  });
  await auditUpdate(context, "PaymentMode", updated.id, existing, updated);
  return updated;
}

export async function deactivatePaymentMode(context: CommercialContext, paymentModeId: string) {
  const existing = await prisma.paymentMode.findFirst({ where: { id: paymentModeId, companyId: context.companyId } });

  if (!existing) {
    throw new ApiError(404, "PAYMENT_MODE_NOT_FOUND", "Payment mode not found.");
  }

  const payments = await prisma.payment.count({ where: { companyId: context.companyId, paymentModeId } });

  if (payments > 0) {
    throw new ApiError(400, "MASTER_IN_USE", "Payment mode is used by payments and cannot be deactivated.");
  }

  const updated = await prisma.paymentMode.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
  await auditDeactivate(context, "PaymentMode", updated.id, existing, updated);
  return updated;
}
