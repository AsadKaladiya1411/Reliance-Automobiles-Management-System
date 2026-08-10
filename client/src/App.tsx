import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AxiosError } from "axios";
import { QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { api, type ApiEnvelope } from "@/lib/api";
import { canAccessView, navItems, type AppView } from "@/lib/navigation";
import type { AppNotification } from "@/lib/notifications";
import { subscribeNotifications } from "@/lib/notifications";
import { queryClient } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
import "./App.css";

type ApiErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    return (error.response?.data as ApiErrorEnvelope | undefined)?.error?.message ?? fallback;
  }

  return fallback;
}

type SystemStatus = {
  service: string;
  companyConfigured: boolean;
  openFinancialYears: number;
  numberSeriesCount: number;
  activeUsers: number;
  timestamp: string;
};

type SetupStatus = {
  requiresBootstrap: boolean;
};

type AuthUser = {
  id: string;
  companyId: string;
  username: string;
  fullName: string;
  roles: string[];
  permissions: string[];
};

type AdminRole = {
  id: string;
  code: string;
  name: string;
  rolePermissions?: Array<{
    permission: { module: string; action: string };
  }>;
};

type AdminUser = {
  id: string;
  username: string;
  email?: string | null;
  fullName: string;
  status: string;
  lastLoginAt?: string | null;
  userRoles: Array<{ role: { id: string; code: string; name: string } }>;
};

type Company = {
  id: string;
  name: string;
  legalName?: string | null;
  gstin?: string | null;
  pan?: string | null;
  tan?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string;
  baseCurrency?: string;
  timezone?: string;
};

type FinancialYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
};

type NumberSeries = {
  id: string;
  documentType: string;
  prefix: string;
  suffix: string;
  padding: number;
  nextNumber: number;
};

type MasterSummary = {
  units: number;
  hsnCodes: number;
  taxRates: number;
  brands: number;
  categories: number;
  subCategories: number;
  products: number;
  productVariants: number;
  warehouses: number;
};

type InventorySummary = {
  stockItems: number;
  movementCount: number;
  totalQuantity: string | number;
  stockValue: string | number;
};

type CommercialMasterSummary = {
  customers: number;
  suppliers: number;
  employees: number;
  vehicles: number;
  paymentModes: number;
};

type AccountingSummary = {
  accounts: number;
  postedJournals: number;
  debitTotal: string | number;
  creditTotal: string | number;
};

type PurchaseSummary = {
  approvedOrders: number;
  approvedGrns: number;
  postedInvoices: number;
  postedReturns: number;
  grossGrandTotal: string | number;
  returnGrandTotal: string | number;
  taxableAmount: string | number;
  totalTaxAmount: string | number;
  grandTotal: string | number;
};

type SalesSummary = {
  approvedQuotations: number;
  approvedOrders: number;
  approvedChallans: number;
  postedInvoices: number;
  postedReturns: number;
  grossGrandTotal: string | number;
  returnGrandTotal: string | number;
  taxableAmount: string | number;
  totalTaxAmount: string | number;
  grandTotal: string | number;
  costOfGoodsSold: string | number;
};

type PartyLedgerSummary = {
  customerBalance: string | number;
  supplierBalance: string | number;
};

type PaymentSummary = {
  receipts: number;
  payments: number;
  receiptTotal: string | number;
  paymentTotal: string | number;
};

type WorkshopSummary = {
  open: number;
  inProgress: number;
  ready: number;
  delivered: number;
};

type GstSummary = {
  inputCgst: string | number;
  inputSgst: string | number;
  inputIgst: string | number;
  outputCgst: string | number;
  outputSgst: string | number;
  outputIgst: string | number;
  inputTax: string | number;
  outputTax: string | number;
  netPayable: string | number;
};

type GstRegisterRow = {
  id: string;
  module: string;
  documentType: string;
  documentNumber: string;
  documentDate: string;
  partyName: string;
  partyGstin?: string | null;
  taxMode: string;
  hsnCodes: string[];
  taxableAmount: string | number;
  cgstAmount: string | number;
  sgstAmount: string | number;
  igstAmount: string | number;
  totalTaxAmount: string | number;
  grandTotal: string | number;
};

type GstRegisters = {
  inputRows: GstRegisterRow[];
  outputRows: GstRegisterRow[];
  inputTotals: Omit<GstRegisterRow, "id" | "module" | "documentType" | "documentNumber" | "documentDate" | "partyName" | "partyGstin" | "taxMode" | "hsnCodes">;
  outputTotals: Omit<GstRegisterRow, "id" | "module" | "documentType" | "documentNumber" | "documentDate" | "partyName" | "partyGstin" | "taxMode" | "hsnCodes">;
};

type PartyOutstanding = {
  customers: Array<{
    party?: { id: string; code: string; name: string; phone?: string | null; creditLimit?: string | number; creditDays?: number };
    debit: string | number;
    credit: string | number;
    balance: string | number;
    creditLimit?: string | number;
    creditAvailable?: string | number;
    creditStatus?: string;
  }>;
  suppliers: Array<{
    party?: { id: string; code: string; name: string; phone?: string | null };
    debit: string | number;
    credit: string | number;
    balance: string | number;
  }>;
};

type Unit = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  status?: string;
};

type HsnCode = {
  id: string;
  code: string;
  description: string;
  status?: string;
};

type TaxRate = {
  id: string;
  name: string;
  hsnCodeId?: string | null;
  cgstRate: string | number;
  sgstRate: string | number;
  igstRate: string | number;
  status?: string;
};

type Brand = {
  id: string;
  code: string;
  name: string;
  status?: string;
};

type Category = {
  id: string;
  code: string;
  name: string;
  status?: string;
};

type Product = {
  id: string;
  code: string;
  name: string;
  brandId?: string | null;
  categoryId: string;
  unitId: string;
  hsnCodeId?: string | null;
  taxRateId?: string | null;
  reorderLevel?: string | number;
  status?: string;
};

type ProductVariant = {
  id: string;
  productId: string;
  code: string;
  name: string;
  salePrice: string | number;
  purchasePrice?: string | number;
  status?: string;
};

type Warehouse = {
  id: string;
  code: string;
  name: string;
  status?: string;
};

type StockBalance = {
  id: string;
  quantity: string | number;
  stockValue: string | number;
  product: { name: string };
  productVariant: { name: string; code: string };
  warehouse: { name: string };
};

type StockMovement = {
  id: string;
  movementType: string;
  documentNumber: string;
  documentDate: string;
  quantityIn: string | number;
  quantityOut: string | number;
  totalValue: string | number;
  product: { name: string };
  productVariant: { name: string; code: string };
  warehouse: { name: string };
};

type ReorderItem = {
  product: { id: string; code: string; name: string };
  category: { name: string };
  unit: { symbol: string };
  reorderLevel: string | number;
  availableQuantity: string | number;
  shortageQuantity: string | number;
  stockValue: string | number;
};

type Customer = {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  gstin?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  placeOfSupply?: string | null;
  customerType: string;
  creditLimit?: string | number;
  creditDays?: number;
  status?: string;
};

type Supplier = {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  gstin?: string | null;
  supplierType: string;
  status?: string;
};

type Employee = {
  id: string;
  code: string;
  name: string;
  designation?: string | null;
  department?: string | null;
  phone?: string | null;
  status?: string;
};

type Vehicle = {
  id: string;
  registrationNumber: string;
  brand: string;
  model: string;
  variant?: string | null;
  chassisNumber?: string | null;
  engineNumber?: string | null;
  vehicleType?: string;
  fuelType?: string | null;
  status?: string;
  customer?: Customer | null;
};

type PaymentMode = {
  id: string;
  code: string;
  name: string;
  paymentType: string;
  requiresReference?: boolean;
  status?: string;
};

type Account = {
  id: string;
  code: string;
  name: string;
  accountType: string;
};

type JournalEntry = {
  id: string;
  entryNumber: string;
  entryDate: string;
  narration?: string | null;
  lines: Array<{
    id: string;
    debitAmount: string | number;
    creditAmount: string | number;
    account: Account;
  }>;
};

type TrialBalance = {
  rows: Array<{
    account?: Account;
    debitTotal: string | number;
    creditTotal: string | number;
    debitBalance: string | number;
    creditBalance: string | number;
  }>;
  debitTotal: string | number;
  creditTotal: string | number;
  debitBalanceTotal: string | number;
  creditBalanceTotal: string | number;
};

type GeneralLedgerLine = {
  id: string;
  account: Account;
  entryNumber: string;
  entryDate: string;
  sourceModule: string;
  sourceType: string;
  debitAmount: string | number;
  creditAmount: string | number;
  narration?: string | null;
};

type FinancialStatementRow = {
  account: Account;
  debitTotal: string | number;
  creditTotal: string | number;
  amount: string | number;
};

type ProfitAndLoss = {
  income: FinancialStatementRow[];
  expenses: FinancialStatementRow[];
  totalIncome: string | number;
  totalExpenses: string | number;
  netProfit: string | number;
};

type BalanceSheet = {
  assets: FinancialStatementRow[];
  liabilities: FinancialStatementRow[];
  equity: FinancialStatementRow[];
  totalAssets: string | number;
  totalLiabilities: string | number;
  totalEquity: string | number;
  totalLiabilitiesAndEquity: string | number;
};

type PartyLedgerEntry = {
  id: string;
  partyType: string;
  documentType: string;
  documentNumber: string;
  entryDate: string;
  debitAmount: string | number;
  creditAmount: string | number;
  customer?: Customer | null;
  supplier?: Supplier | null;
};

type Payment = {
  id: string;
  partyType: string;
  paymentNumber: string;
  paymentDate: string;
  amount: string | number;
  customer?: Customer | null;
  supplier?: Supplier | null;
  paymentMode: PaymentMode;
  allocations?: Array<{ id: string; documentNumber: string; allocatedAmount: string | number }>;
};

type OpenSettlementDocument = {
  id: string;
  documentType: string;
  documentId?: string | null;
  documentNumber: string;
  entryDate: string;
  documentAmount: string | number;
  allocatedAmount: string | number;
  openAmount: string | number;
  narration?: string | null;
};

type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

type FinancialNote = {
  id: string;
  partyType: string;
  noteType: string;
  noteNumber: string;
  noteDate: string;
  amount: string | number;
  reason: string;
  customer?: Customer | null;
  supplier?: Supplier | null;
};

type PurchaseInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: string | number;
  status: string;
  supplier: Supplier;
  warehouse: Warehouse;
  goodsReceiptNote?: GoodsReceiptNote | null;
  lines: Array<{ id: string; productVariant: ProductVariant; quantity: string | number; lineTotal?: string | number }>;
};

type PurchaseOrder = {
  id: string;
  orderNumber: string;
  orderDate: string;
  expectedDate?: string | null;
  grandTotal: string | number;
  status: string;
  receiptStatus?: string;
  orderedQuantity?: string | number;
  receivedQuantity?: string | number;
  supplier: Supplier;
  lines: Array<{ id: string; productVariant: ProductVariant; quantity: string | number; unitCost: string | number; lineTotal: string | number }>;
};

type GoodsReceiptNote = {
  id: string;
  grnNumber: string;
  grnDate: string;
  status: string;
  invoiceStatus?: string;
  receivedQuantity?: string | number;
  invoicedQuantity?: string | number;
  supplier: Supplier;
  warehouse: Warehouse;
  purchaseOrder?: PurchaseOrder | null;
  lines: Array<{ id: string; productVariant: ProductVariant; quantity: string | number }>;
};

type SalesInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxMode: string;
  taxableAmount: string | number;
  cgstAmount: string | number;
  sgstAmount: string | number;
  igstAmount: string | number;
  totalTaxAmount: string | number;
  grandTotal: string | number;
  status: string;
  narration?: string | null;
  customer: Customer;
  warehouse: Warehouse;
  salesOrder?: SalesOrder | null;
  deliveryChallan?: DeliveryChallan | null;
  lines: Array<{
    id: string;
    hsnCode?: string | null;
    productVariant: ProductVariant;
    quantity: string | number;
    unitPrice: string | number;
    discountAmount: string | number;
    taxableAmount: string | number;
    cgstRate: string | number;
    sgstRate: string | number;
    igstRate: string | number;
    cgstAmount: string | number;
    sgstAmount: string | number;
    igstAmount: string | number;
    lineTotal: string | number;
  }>;
};

type SalesQuotation = {
  id: string;
  quotationNumber: string;
  quotationDate: string;
  validUntil?: string | null;
  grandTotal: string | number;
  status: string;
  customer: Customer;
  lines: Array<{ id: string; productVariant: ProductVariant; quantity: string | number; unitPrice: string | number; discountAmount?: string | number; lineTotal: string | number }>;
};

type SalesOrder = {
  id: string;
  orderNumber: string;
  orderDate: string;
  expectedDate?: string | null;
  grandTotal: string | number;
  status: string;
  deliveryStatus?: string;
  orderedQuantity?: string | number;
  deliveredQuantity?: string | number;
  customer: Customer;
  quotation?: SalesQuotation | null;
  lines: Array<{ id: string; productVariant: ProductVariant; quantity: string | number; unitPrice: string | number; discountAmount?: string | number; lineTotal: string | number }>;
};

type DeliveryChallan = {
  id: string;
  challanNumber: string;
  challanDate: string;
  status: string;
  invoiceStatus?: string;
  deliveredQuantity?: string | number;
  invoicedQuantity?: string | number;
  customer: Customer;
  warehouse: Warehouse;
  salesOrder?: SalesOrder | null;
  lines: Array<{ id: string; productVariant: ProductVariant; quantity: string | number }>;
};

type PurchaseReturn = {
  id: string;
  returnNumber: string;
  returnDate: string;
  grandTotal: string | number;
  reason: string;
  supplier: Supplier;
  purchaseInvoice: PurchaseInvoice;
};

type SalesReturn = {
  id: string;
  returnNumber: string;
  returnDate: string;
  grandTotal: string | number;
  reason: string;
  customer: Customer;
  salesInvoice: SalesInvoice;
};

type AuditLog = {
  id: string;
  module: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
  createdAt: string;
  actor?: { fullName: string; username: string } | null;
};

type ApprovalRule = {
  id: string;
  module: string;
  documentType: string;
  triggerAction: string;
  requireApproval: boolean;
  minimumAmount?: string | number | null;
  status: string;
};

type ApprovalRequest = {
  id: string;
  module: string;
  documentType: string;
  documentNumber: string;
  requestedAction: string;
  amount?: string | number | null;
  status: string;
  reason?: string | null;
  decisionNotes?: string | null;
};

type JobCard = {
  id: string;
  jobCardNumber: string;
  jobDate: string;
  expectedDeliveryAt?: string | null;
  odometerReading?: number;
  fuelLevel?: string | null;
  status: string;
  complaint: string;
  diagnosis?: string | null;
  workNotes?: string | null;
  technicianStatus?: string;
  technicianNotes?: string | null;
  technicianStartedAt?: string | null;
  technicianCompletedAt?: string | null;
  inspectionNotes?: string | null;
  qualityCheckedAt?: string | null;
  readyAt?: string | null;
  deliveryNotes?: string | null;
  deliveredAt?: string | null;
  estimatedTotal: string | number;
  estimatedPartsTotal?: string | number;
  estimatedLaborTotal?: string | number;
  partsIssuedAt?: string | null;
  billingNumber?: string | null;
  billingTaxMode?: string;
  billingHsnCode?: string | null;
  billingTaxableAmount?: string | number;
  billingCgstAmount?: string | number;
  billingSgstAmount?: string | number;
  billingIgstAmount?: string | number;
  billingTotalTaxAmount?: string | number;
  billingAmount?: string | number;
  billedAt?: string | null;
  customer: Customer;
  vehicle: Vehicle;
  advisor?: Employee | null;
  technician?: Employee | null;
  parts?: Array<{ id: string; productVariant: ProductVariant; quantity: string | number; estimatedRate: string | number; estimatedAmount: string | number }>;
  laborLines?: Array<{ id: string; description: string; estimatedAmount: string | number }>;
};

const modules = [
  { name: "Foundation", icon: "FD", status: "In progress", text: "Company, RBAC, audit, number series" },
  { name: "Masters", icon: "MS", status: "Planned", text: "Products, customers, suppliers, employees, vehicles" },
  { name: "Inventory", icon: "IN", status: "Planned", text: "Warehouse hierarchy, stock ledger, valuation" },
  { name: "Purchase", icon: "PO", status: "Planned", text: "PO, GRN, purchase invoice, supplier ledger" },
  { name: "Sales", icon: "SL", status: "Planned", text: "Orders, invoices, returns, customer payments" },
  { name: "Workshop", icon: "WS", status: "Planned", text: "Job cards, labor, parts consumption, billing" },
  { name: "Accounting", icon: "AC", status: "Planned", text: "Journals, GL, vouchers, statements" },
  { name: "Reports", icon: "RP", status: "Planned", text: "Operational, GST, financial analytics" },
];

function useSystemStatus() {
  return useQuery({
    queryKey: ["system-status"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<SystemStatus>>("/system/status");
      return response.data.data;
    },
  });
}

function useSetupStatus() {
  return useQuery({
    queryKey: ["setup-status"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<SetupStatus>>("/setup/status");
      return response.data.data;
    },
  });
}

function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    retry: false,
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<{ user: AuthUser }>>("/auth/me");
      return response.data.data.user;
    },
  });
}

function useCompany(enabled = true) {
  return useQuery({
    queryKey: ["company"],
    enabled,
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<Company>>("/company");
      return response.data.data;
    },
  });
}

function useInvoiceCompanyProfile(enabled = true) {
  return useQuery({
    queryKey: ["invoice-company-profile"],
    enabled,
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<Company>>("/company/invoice-profile");
      return response.data.data;
    },
  });
}

function useWorkshopDocumentProfile(enabled = true) {
  return useQuery({
    queryKey: ["workshop-document-profile"],
    enabled,
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<Company>>("/workshop/document-profile");
      return response.data.data;
    },
  });
}

function useFinancialYears(enabled = true) {
  return useQuery({
    queryKey: ["financial-years"],
    enabled,
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<FinancialYear[]>>("/financial-years");
      return response.data.data;
    },
  });
}

function useNumberSeries(enabled = true) {
  return useQuery({
    queryKey: ["number-series"],
    enabled,
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<NumberSeries[]>>("/number-series");
      return response.data.data;
    },
  });
}

function useMasterSummary() {
  return useQuery({
    queryKey: ["master-summary"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<MasterSummary>>("/masters/summary");
      return response.data.data;
    },
  });
}

function useInventorySummary() {
  return useQuery({
    queryKey: ["inventory-summary"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<InventorySummary>>("/inventory/summary");
      return response.data.data;
    },
  });
}

function useCommercialMasterSummary() {
  return useQuery({
    queryKey: ["commercial-master-summary"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<CommercialMasterSummary>>("/commercial-masters/summary");
      return response.data.data;
    },
  });
}

function useAccountingSummary() {
  return useQuery({
    queryKey: ["accounting-summary"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<AccountingSummary>>("/accounting/summary");
      return response.data.data;
    },
  });
}

function usePurchaseSummary() {
  return useQuery({
    queryKey: ["purchase-summary"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<PurchaseSummary>>("/purchase/summary");
      return response.data.data;
    },
  });
}

function useSalesSummary() {
  return useQuery({
    queryKey: ["sales-summary"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<SalesSummary>>("/sales/summary");
      return response.data.data;
    },
  });
}

function usePartyLedgerSummary() {
  return useQuery({
    queryKey: ["party-ledger-summary"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<PartyLedgerSummary>>("/accounting/party-ledger-summary");
      return response.data.data;
    },
  });
}

function useGstSummary() {
  return useQuery({
    queryKey: ["gst-summary"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<GstSummary>>("/accounting/gst-summary");
      return response.data.data;
    },
  });
}

function gstDateParams(filters: { from: string; to: string }) {
  const params = new URLSearchParams();
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }

  return params.toString();
}

function useFilteredGstSummary(filters: { from: string; to: string }) {
  return useQuery({
    queryKey: ["gst-summary", filters],
    queryFn: async () => {
      const query = gstDateParams(filters);
      const response = await api.get<ApiEnvelope<GstSummary>>(`/accounting/gst-summary${query ? `?${query}` : ""}`);
      return response.data.data;
    },
  });
}

function useGstRegisters(filters: { from: string; to: string }) {
  return useQuery({
    queryKey: ["gst-registers", filters],
    queryFn: async () => {
      const query = gstDateParams(filters);
      const response = await api.get<ApiEnvelope<GstRegisters>>(`/accounting/gst-registers${query ? `?${query}` : ""}`);
      return response.data.data;
    },
  });
}

function usePaymentSummary() {
  return useQuery({
    queryKey: ["payment-summary"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<PaymentSummary>>("/payments/summary");
      return response.data.data;
    },
  });
}

function useAuditLogs(enabled = true) {
  return useQuery({
    queryKey: ["audit-logs"],
    enabled,
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<AuditLog[]>>("/audit/logs");
      return response.data.data;
    },
  });
}

function usePartyOutstanding() {
  return useQuery({
    queryKey: ["party-outstanding"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<PartyOutstanding>>("/accounting/party-outstanding");
      return response.data.data;
    },
  });
}

function useWorkshopSummary() {
  return useQuery({
    queryKey: ["workshop-summary"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<WorkshopSummary>>("/workshop/summary");
      return response.data.data;
    },
  });
}

function useMasterList<T>(key: string, path: string) {
  return useQuery({
    queryKey: [key],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<T[]>>(path);
      return response.data.data;
    },
  });
}

function usePagedMasterList<T>(key: string, path: string, page: number, search: string) {
  return useQuery({
    queryKey: [key, page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "12" });
      if (search.trim()) {
        params.set("search", search.trim());
      }
      const response = await api.get<ApiEnvelope<PagedResult<T>>>(`${path}?${params.toString()}`);
      return response.data.data;
    },
  });
}

function downloadCsv(path: string) {
  window.location.href = `${api.defaults.baseURL}${path}`;
}

function SetupForm() {
  const [form, setForm] = useState({
    companyName: "Reliance Automobiles",
    adminFullName: "",
    adminUsername: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/setup/bootstrap", form);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
    onError: () => {
      setError("Setup failed. Check required fields and password length.");
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    mutation.mutate();
  }

  return (
    <AuthPanel title="Initial System Setup" subtitle="Create the company record and first Super Admin user.">
      <form className="auth-form" onSubmit={submit}>
        <label>
          Company name
          <input
            value={form.companyName}
            onChange={(event) => setForm({ ...form, companyName: event.target.value })}
          />
        </label>
        <label>
          Admin full name
          <input
            value={form.adminFullName}
            onChange={(event) => setForm({ ...form, adminFullName: event.target.value })}
          />
        </label>
        <label>
          Username
          <input
            value={form.adminUsername}
            onChange={(event) => setForm({ ...form, adminUsername: event.target.value })}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.adminEmail}
            onChange={(event) => setForm({ ...form, adminEmail: event.target.value })}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.adminPassword}
            onChange={(event) => setForm({ ...form, adminPassword: event.target.value })}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating..." : "Create Super Admin"}
        </Button>
      </form>
    </AuthPanel>
  );
}

function LoginForm({ onRegister }: { onRegister: () => void }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/auth/login", form);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
    onError: (error) => {
      setError(apiErrorMessage(error, "Invalid username or password."));
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    mutation.mutate();
  }

  return (
    <AuthPanel title="Sign in to RAMS" subtitle="Use your assigned ERP user account.">
      <form className="auth-form" onSubmit={submit}>
        <label>
          Username
          <input
            autoComplete="username"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Signing in..." : "Sign In"}
        </Button>
      </form>
      <p className="auth-switch">
        New to RAMS? <button type="button" onClick={onRegister}>Register account</button>
      </p>
    </AuthPanel>
  );
}

function RegisterForm({ onLogin }: { onLogin: () => void }) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/auth/register", form);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
    onError: (error) => {
      setError(apiErrorMessage(error, "Registration failed. Please check your details and try again."));
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.username.trim() || !form.email.trim()) {
      setError("Username and email are required.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    mutation.mutate();
  }

  return (
    <AuthPanel title="Register for RAMS" subtitle="Create a staff account for the configured company.">
      <form className="auth-form" onSubmit={submit}>
        <label>
          Username
          <input autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label>
          Password
          <input
            autoComplete="new-password"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating..." : "Register"}
        </Button>
      </form>
      <p className="auth-switch">
        Already registered? <button type="button" onClick={onLogin}>Sign in</button>
      </p>
    </AuthPanel>
  );
}

function AuthPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="brand-lockup">
          <div className="brand-mark">R</div>
          <div>
            <strong>RAMS</strong>
            <span>Automobile ERP</span>
          </div>
        </div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </section>
    </main>
  );
}

function DashboardShell({ user }: { user: AuthUser }) {
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const visibleNavItems = navItems.filter((item) => canAccessView(user, item.id));
  const canAccessSettings = canAccessView(user, "settings");
  const status = useSystemStatus();
  const company = useCompany(canAccessSettings);
  const financialYears = useFinancialYears(canAccessSettings);
  const numberSeries = useNumberSeries(canAccessSettings);
  const auditLogs = useAuditLogs(canAccessSettings);
  const masterSummary = useMasterSummary();
  const inventorySummary = useInventorySummary();
  const commercialMasterSummary = useCommercialMasterSummary();
  const accountingSummary = useAccountingSummary();
  const purchaseSummary = usePurchaseSummary();
  const salesSummary = useSalesSummary();
  const partyLedgerSummary = usePartyLedgerSummary();
  const gstSummary = useGstSummary();
  const paymentSummary = usePaymentSummary();
  const workshopSummary = useWorkshopSummary();
  const logout = useMutation({
    mutationFn: async () => {
      await api.post("/auth/logout");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">R</div>
          <div>
            <strong>RAMS</strong>
            <span>Automobile ERP</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {visibleNavItems.map((item) => (
            <button
              className={activeView === item.id ? "active" : ""}
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-assurance">
          <span className="assurance-dot" />
          <div><strong>Protected workspace</strong><span>Role-based access & audit trail</span></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Reliance Automobiles</p>
            <h1>{navItems.find((item) => item.id === activeView)?.label ?? "Workspace"}</h1>
          </div>
          <div className="user-actions">
            <div className="user-identity"><span>{user.fullName}</span><small>{user.roles.join(" · ")}</small></div>
            <Button variant="outline" onClick={() => logout.mutate()}>
              Sign Out
            </Button>
          </div>
        </header>

        {activeView === "dashboard" ? (
          <DashboardView
            accountingSummary={accountingSummary.data}
            commercialMasterSummary={commercialMasterSummary.data}
            inventorySummary={inventorySummary.data}
            masterSummary={masterSummary.data}
            purchaseSummary={purchaseSummary.data}
            salesSummary={salesSummary.data}
            partyLedgerSummary={partyLedgerSummary.data}
            paymentSummary={paymentSummary.data}
            gstSummary={gstSummary.data}
            workshopSummary={workshopSummary.data}
            status={status}
          />
        ) : null}

        {activeView === "masters" ? (
          <MastersView
            commercialMasterSummary={commercialMasterSummary.data}
            masterSummary={masterSummary.data}
          />
        ) : null}

        {activeView === "inventory" ? (
          <InventoryView inventorySummary={inventorySummary.data} />
        ) : null}

        {activeView === "workshop" ? <WorkshopView workshopSummary={workshopSummary.data} /> : null}

        {activeView === "transactions" ? (
          <TransactionsView
            accountingSummary={accountingSummary.data}
            purchaseSummary={purchaseSummary.data}
            salesSummary={salesSummary.data}
            partyLedgerSummary={partyLedgerSummary.data}
            paymentSummary={paymentSummary.data}
            gstSummary={gstSummary.data}
          />
        ) : null}

        {activeView === "reports" ? (
          <ReportsView
            accountingSummary={accountingSummary.data}
            gstSummary={gstSummary.data}
            inventorySummary={inventorySummary.data}
            partyLedgerSummary={partyLedgerSummary.data}
            purchaseSummary={purchaseSummary.data}
            salesSummary={salesSummary.data}
            workshopSummary={workshopSummary.data}
          />
        ) : null}

        {activeView === "settings" ? (
          <SettingsView
            company={company.data}
            financialYears={financialYears.data ?? []}
            numberSeries={numberSeries.data ?? []}
            auditLogs={auditLogs.data ?? []}
          />
        ) : null}
      </section>
    </main>
  );
}

function DashboardView({
  accountingSummary,
  commercialMasterSummary,
  status,
  masterSummary,
  inventorySummary,
  purchaseSummary,
  salesSummary,
  partyLedgerSummary,
  paymentSummary,
  gstSummary,
  workshopSummary,
}: {
  accountingSummary?: AccountingSummary;
  commercialMasterSummary?: CommercialMasterSummary;
  status: ReturnType<typeof useSystemStatus>;
  masterSummary?: MasterSummary;
  inventorySummary?: InventorySummary;
  purchaseSummary?: PurchaseSummary;
  salesSummary?: SalesSummary;
  partyLedgerSummary?: PartyLedgerSummary;
  paymentSummary?: PaymentSummary;
  gstSummary?: GstSummary;
  workshopSummary?: WorkshopSummary;
}) {
  return (
    <>
      <section className="status-strip" aria-label="System status">
        <div>
          <span>API</span>
          <strong>{status.isError ? "Unavailable" : status.data?.service ?? "Checking"}</strong>
        </div>
        <div>
          <span>Company</span>
          <strong>{status.data?.companyConfigured ? "Configured" : "Pending"}</strong>
        </div>
        <div>
          <span>Financial Year</span>
          <strong>{status.data ? `${status.data.openFinancialYears} open` : "Checking"}</strong>
        </div>
        <div>
          <span>Number Series</span>
          <strong>{status.data ? status.data.numberSeriesCount : "Checking"}</strong>
        </div>
      </section>

      <section className="setup-panel" aria-label="Master data readiness">
        <h2>Master Data Readiness</h2>
        <MasterReadinessGrid masterSummary={masterSummary} />
      </section>

      <section className="setup-panel" aria-label="Commercial master readiness">
        <h2>Commercial Master Readiness</h2>
        <CommercialReadinessGrid commercialMasterSummary={commercialMasterSummary} />
      </section>

      <section className="setup-panel" aria-label="Inventory foundation">
        <h2>Inventory Foundation</h2>
        <InventoryReadinessGrid inventorySummary={inventorySummary} />
      </section>

      <section className="setup-panel" aria-label="Accounting foundation">
        <h2>Accounting Foundation</h2>
        <AccountingReadinessGrid accountingSummary={accountingSummary} />
      </section>

      <section className="setup-panel" aria-label="Purchase posting">
        <h2>Purchase Posting</h2>
        <PurchaseReadinessGrid purchaseSummary={purchaseSummary} />
      </section>

      <section className="setup-panel" aria-label="Sales posting">
        <h2>Sales Posting</h2>
        <SalesReadinessGrid salesSummary={salesSummary} />
      </section>

      <section className="setup-panel" aria-label="Ledger and GST reports">
        <h2>Ledger and GST Reports</h2>
        <ReportReadinessGrid partyLedgerSummary={partyLedgerSummary} gstSummary={gstSummary} />
      </section>

      <section className="setup-panel" aria-label="Payments">
        <h2>Payments</h2>
        <PaymentReadinessGrid paymentSummary={paymentSummary} />
      </section>

      <section className="setup-panel" aria-label="Workshop">
        <h2>Workshop</h2>
        <WorkshopReadinessGrid workshopSummary={workshopSummary} />
      </section>

      <ModuleGrid />
    </>
  );
}

function WorkshopView({ workshopSummary }: { workshopSummary?: WorkshopSummary }) {
  const [stage, setStage] = useState<"intake" | "inspection" | "parts" | "billing" | "history">("intake");
  const documentCompany = useWorkshopDocumentProfile();
  const customers = useMasterList<Customer>("customers", "/commercial-masters/customers");
  const vehicles = useMasterList<Vehicle>("vehicles", "/commercial-masters/vehicles");
  const employees = useMasterList<Employee>("employees", "/commercial-masters/employees");
  const variants = useMasterList<ProductVariant>("product-variants", "/masters/product-variants");
  const taxRates = useMasterList<TaxRate>("tax-rates", "/masters/tax-rates");
  const warehouses = useMasterList<Warehouse>("warehouses", "/masters/warehouses");
  const jobCards = useMasterList<JobCard>("job-cards", "/workshop/job-cards");
  const serviceHistory = useMasterList<JobCard>("service-history", "/workshop/service-history");

  return (
    <>
      <section className="view-header">
        <div><p className="section-kicker">Service operations</p><h2>Workshop</h2><p>Move each vehicle from intake to inspection, parts issue, billing and service history.</p></div>
      </section>
      <section className="setup-panel compact-summary">
        <div className="panel-heading"><div><p className="section-kicker dark">Live workload</p><h2>Workshop readiness</h2></div><span className="context-note">Complete inspection before marking ready. Issue estimated parts before billing.</span></div>
        <WorkshopReadinessGrid workshopSummary={workshopSummary} />
      </section>
      <section className="stage-tabs" aria-label="Workshop workflow steps">
        {([['intake', '1. Vehicle intake'], ['inspection', '2. Inspection & work'], ['parts', '3. Issue parts'], ['billing', '4. Bill & deliver'], ['history', '5. Service history']] as const).map(([id, label]) => (
          <button type="button" key={id} className={stage === id ? "active" : ""} onClick={() => setStage(id)}>{label}</button>
        ))}
      </section>
      {stage !== "history" ? <JobCardPanel
          company={documentCompany.data}
          stage={stage}
          customers={customers.data ?? []}
          employees={employees.data ?? []}
          items={jobCards.data ?? []}
          taxRates={taxRates.data ?? []}
          variants={variants.data ?? []}
          vehicles={vehicles.data ?? []}
          warehouses={warehouses.data ?? []}
        /> : null}
      {stage === "history" ? <ServiceHistoryPanel company={documentCompany.data} items={serviceHistory.data ?? []} /> : null}
      <ModuleGrid filter={["Workshop"]} />
    </>
  );
}

function MastersView({
  commercialMasterSummary,
  masterSummary,
}: {
  commercialMasterSummary?: CommercialMasterSummary;
  masterSummary?: MasterSummary;
}) {
  const [section, setSection] = useState<"catalog" | "parties" | "workshop" | "operations">("catalog");
  const units = useMasterList<Unit>("units", "/masters/units");
  const hsnCodes = useMasterList<HsnCode>("hsn-codes", "/masters/hsn-codes");
  const taxRates = useMasterList<TaxRate>("tax-rates", "/masters/tax-rates");
  const brands = useMasterList<Brand>("brands", "/masters/brands");
  const categories = useMasterList<Category>("categories", "/masters/categories");
  const products = useMasterList<Product>("products", "/masters/products");
  const variants = useMasterList<ProductVariant>("product-variants", "/masters/product-variants");
  const warehouses = useMasterList<Warehouse>("warehouses", "/masters/warehouses");
  const customers = useMasterList<Customer>("customers", "/commercial-masters/customers");
  const suppliers = useMasterList<Supplier>("suppliers", "/commercial-masters/suppliers");
  const employees = useMasterList<Employee>("employees", "/commercial-masters/employees");
  const vehicles = useMasterList<Vehicle>("vehicles", "/commercial-masters/vehicles");
  const paymentModes = useMasterList<PaymentMode>("payment-modes", "/commercial-masters/payment-modes");

  return (
    <>
      <section className="view-header">
        <div>
          <p className="section-kicker">Business setup</p>
          <h2>Master data</h2>
          <p>Create reusable records once, then use them across inventory, purchase, sales and workshop workflows.</p>
        </div>
      </section>
      <section className="section-tabs" aria-label="Master data categories">
        {([
          ["catalog", "Products & tax", "Units, tax, brands and catalog"],
          ["parties", "Customers & suppliers", "Trading relationships"],
          ["workshop", "Workshop", "Employees and vehicles"],
          ["operations", "Operations", "Warehouses and payment modes"],
        ] as const).map(([id, label, description]) => (
          <button key={id} type="button" className={section === id ? "active" : ""} onClick={() => setSection(id)}>
            <strong>{label}</strong>
            <span>{description}</span>
          </button>
        ))}
      </section>
      {section === "catalog" ? (
        <section className="setup-panel compact-summary">
          <div className="panel-heading">
            <div><p className="section-kicker">Readiness</p><h2>Product catalog</h2></div>
            <span className="context-note">Recommended order: Unit → HSN → Tax → Brand → Category → Product → Variant</span>
          </div>
          <MasterReadinessGrid masterSummary={masterSummary} />
        </section>
      ) : null}
      {section === "parties" ? (
        <section className="setup-panel compact-summary">
          <div className="panel-heading"><div><p className="section-kicker">Readiness</p><h2>Commercial relationships</h2></div></div>
          <CommercialReadinessGrid commercialMasterSummary={commercialMasterSummary} />
        </section>
      ) : null}
      <section className="masters-grid">
        {section === "parties" ? <><CustomerPanel items={customers.data ?? []} /><SupplierPanel items={suppliers.data ?? []} /></> : null}
        {section === "workshop" ? <><EmployeePanel items={employees.data ?? []} /><VehiclePanel customers={customers.data ?? []} items={vehicles.data ?? []} /></> : null}
        {section === "operations" ? <><PaymentModePanel items={paymentModes.data ?? []} /><SimpleCodeNamePanel items={warehouses.data ?? []} path="/masters/warehouses" queryKeys={["warehouses", "master-summary"]} title="Warehouses" /></> : null}
        {section === "catalog" ? <>
          <UnitMasterPanel items={units.data ?? []} />
          <HsnMasterPanel items={hsnCodes.data ?? []} />
          <TaxRatePanel hsnCodes={hsnCodes.data ?? []} items={taxRates.data ?? []} />
          <SimpleCodeNamePanel items={brands.data ?? []} path="/masters/brands" queryKeys={["brands", "master-summary"]} title="Brands" />
          <SimpleCodeNamePanel items={categories.data ?? []} path="/masters/categories" queryKeys={["categories", "master-summary"]} title="Categories" />
          <ProductPanel brands={brands.data ?? []} categories={categories.data ?? []} hsnCodes={hsnCodes.data ?? []} items={products.data ?? []} taxRates={taxRates.data ?? []} units={units.data ?? []} />
          <VariantPanel items={variants.data ?? []} products={products.data ?? []} />
        </> : null}
      </section>
    </>
  );
}

function InventoryView({ inventorySummary }: { inventorySummary?: InventorySummary }) {
  const variants = useMasterList<ProductVariant>("product-variants", "/masters/product-variants");
  const warehouses = useMasterList<Warehouse>("warehouses", "/masters/warehouses");
  const stockBalances = useMasterList<StockBalance>("stock-balances", "/inventory/stock-balances");
  const stockMovements = useMasterList<StockMovement>("stock-movements", "/inventory/stock-movements");
  const reorderItems = useMasterList<ReorderItem>("reorder-items", "/inventory/reorder-items");

  return (
    <>
      <section className="view-header">
        <h2>Inventory</h2>
        <p>Stock balances, opening stock, movement history, and future purchase/sales posting impact.</p>
      </section>
      <section className="setup-panel">
        <h2>Inventory Foundation</h2>
        <InventoryReadinessGrid inventorySummary={inventorySummary} />
      </section>
      <OpeningStockPanel variants={variants.data ?? []} warehouses={warehouses.data ?? []} />
      <StockAdjustmentPanel variants={variants.data ?? []} warehouses={warehouses.data ?? []} />
      <StockTransferPanel variants={variants.data ?? []} warehouses={warehouses.data ?? []} />
      <section className="setup-panel">
        <h2>Reorder Alerts</h2>
        <MasterList
          items={(reorderItems.data ?? []).map((item) => ({
            id: item.product.id,
            label: `${item.product.code} / ${item.product.name}`,
            meta: `${item.availableQuantity} ${item.unit.symbol} available / reorder ${item.reorderLevel} / shortage ${item.shortageQuantity}`,
          }))}
        />
      </section>
      <section className="setup-panel">
        <h2>Current Stock</h2>
        <MasterList
          items={(stockBalances.data ?? []).map((balance) => ({
            id: balance.id,
            label: `${balance.product.name} / ${balance.productVariant.name}`,
            meta: `${balance.quantity} @ ${balance.warehouse.name}`,
          }))}
        />
      </section>
      <section className="setup-panel">
        <h2>Stock Movement History</h2>
        <MasterList
          items={(stockMovements.data ?? []).map((movement) => ({
            id: movement.id,
            label: `${movement.documentNumber} / ${movement.productVariant.name}`,
            meta: `${movement.movementType}: +${movement.quantityIn} / -${movement.quantityOut}`,
          }))}
        />
      </section>
      <ModuleGrid filter={["Inventory"]} />
    </>
  );
}

function TransactionsView({
  accountingSummary,
  purchaseSummary,
  salesSummary,
  partyLedgerSummary,
  paymentSummary,
  gstSummary,
}: {
  accountingSummary?: AccountingSummary;
  purchaseSummary?: PurchaseSummary;
  salesSummary?: SalesSummary;
  partyLedgerSummary?: PartyLedgerSummary;
  paymentSummary?: PaymentSummary;
  gstSummary?: GstSummary;
}) {
  const [section, setSection] = useState<"purchase" | "sales" | "payments" | "accounting">("purchase");
  const [purchaseStage, setPurchaseStage] = useState<"order" | "grn" | "invoice" | "return">("order");
  const [salesStage, setSalesStage] = useState<"quote" | "order" | "delivery" | "invoice" | "return">("quote");
  const [paymentStage, setPaymentStage] = useState<"payment" | "notes" | "outstanding">("payment");
  const [accountingStage, setAccountingStage] = useState<"accounts" | "journals" | "statements" | "ledger">("accounts");
  const invoiceCompany = useInvoiceCompanyProfile(section === "sales");
  const accounts = useMasterList<Account>("accounts", "/accounting/accounts");
  const journalEntries = useMasterList<JournalEntry>("journal-entries", "/accounting/journal-entries");
  const trialBalance = useQuery({
    queryKey: ["trial-balance"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<TrialBalance>>("/accounting/trial-balance");
      return response.data.data;
    },
  });
  const generalLedger = useMasterList<GeneralLedgerLine>("general-ledger", "/accounting/general-ledger");
  const profitAndLoss = useQuery({
    queryKey: ["profit-and-loss"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<ProfitAndLoss>>("/accounting/profit-and-loss");
      return response.data.data;
    },
  });
  const balanceSheet = useQuery({
    queryKey: ["balance-sheet"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<BalanceSheet>>("/accounting/balance-sheet");
      return response.data.data;
    },
  });
  const suppliers = useMasterList<Supplier>("suppliers", "/commercial-masters/suppliers");
  const variants = useMasterList<ProductVariant>("product-variants", "/masters/product-variants");
  const warehouses = useMasterList<Warehouse>("warehouses", "/masters/warehouses");
  const purchaseOrders = useMasterList<PurchaseOrder>("purchase-orders", "/purchase/orders");
  const grns = useMasterList<GoodsReceiptNote>("goods-receipt-notes", "/purchase/grns");
  const purchaseInvoices = useMasterList<PurchaseInvoice>("purchase-invoices", "/purchase/invoices");
  const purchaseReturns = useMasterList<PurchaseReturn>("purchase-returns", "/purchase/returns");
  const customers = useMasterList<Customer>("customers", "/commercial-masters/customers");
  const salesQuotations = useMasterList<SalesQuotation>("sales-quotations", "/sales/quotations");
  const salesOrders = useMasterList<SalesOrder>("sales-orders", "/sales/orders");
  const deliveryChallans = useMasterList<DeliveryChallan>("delivery-challans", "/sales/delivery-challans");
  const salesInvoices = useMasterList<SalesInvoice>("sales-invoices", "/sales/invoices");
  const salesReturns = useMasterList<SalesReturn>("sales-returns", "/sales/returns");
  const partyLedger = useMasterList<PartyLedgerEntry>("party-ledger", "/accounting/party-ledger");
  const paymentModes = useMasterList<PaymentMode>("payment-modes", "/commercial-masters/payment-modes");
  const payments = useMasterList<Payment>("payments", "/payments");
  const notes = useMasterList<FinancialNote>("notes", "/notes");
  const outstanding = usePartyOutstanding();

  return (
    <>
      <section className="view-header">
        <div>
          <p className="section-kicker">Daily operations</p>
          <h2>Transactions</h2>
          <p>Choose one workflow and complete it in order. Only the forms relevant to that job are shown.</p>
        </div>
      </section>
      <section className="section-tabs workflow-tabs" aria-label="Transaction workflows">
        {([
          ["purchase", "Purchase", "Order → Receive → Invoice"],
          ["sales", "Sales", "Quote → Order → Deliver → Invoice"],
          ["payments", "Payments", "Receive, pay and allocate"],
          ["accounting", "Accounting", "Accounts, journals and ledgers"],
        ] as const).map(([id, label, description]) => (
          <button key={id} type="button" className={section === id ? "active" : ""} onClick={() => setSection(id)}>
            <strong>{label}</strong><span>{description}</span>
          </button>
        ))}
      </section>
      <section className="workflow-guide" aria-label="Current workflow guidance">
        <div className="workflow-badge">{section === "purchase" ? "PO" : section === "sales" ? "SO" : section === "payments" ? "₹" : "GL"}</div>
        <div>
          <strong>{section === "purchase" ? "Purchase workflow" : section === "sales" ? "Sales workflow" : section === "payments" ? "Settlement workflow" : "Accounting workspace"}</strong>
          <p>{section === "purchase" ? "Create the purchase order first, record receipt with a GRN, then post the supplier invoice." : section === "sales" ? "Start with a quotation, confirm the order, record delivery, then post the customer invoice." : section === "payments" ? "Choose the party, enter the amount, then allocate it against an open invoice." : "Seed the chart once, then use journals and reports for controlled financial work."}</p>
        </div>
      </section>
      {section === "purchase" ? <section className="stage-tabs" aria-label="Purchase steps">
        {([['order', '1. Purchase order'], ['grn', '2. Goods receipt'], ['invoice', '3. Supplier invoice'], ['return', '4. Purchase return']] as const).map(([id, label]) => <button type="button" key={id} className={purchaseStage === id ? 'active' : ''} onClick={() => setPurchaseStage(id)}>{label}</button>)}
      </section> : null}
      {section === "sales" ? <section className="stage-tabs" aria-label="Sales steps">
        {([['quote', '1. Quotation'], ['order', '2. Sales order'], ['delivery', '3. Delivery'], ['invoice', '4. Customer invoice'], ['return', '5. Sales return']] as const).map(([id, label]) => <button type="button" key={id} className={salesStage === id ? 'active' : ''} onClick={() => setSalesStage(id)}>{label}</button>)}
      </section> : null}
      {section === "payments" ? <section className="stage-tabs" aria-label="Payment workspaces">
        {([['payment', 'Receipts & payments'], ['notes', 'Credit / debit notes'], ['outstanding', 'Outstanding balances']] as const).map(([id, label]) => <button type="button" key={id} className={paymentStage === id ? 'active' : ''} onClick={() => setPaymentStage(id)}>{label}</button>)}
      </section> : null}
      {section === "accounting" ? <section className="stage-tabs" aria-label="Accounting workspaces">
        {([['accounts', 'Chart of accounts'], ['journals', 'Journals & contra'], ['statements', 'Financial statements'], ['ledger', 'General & party ledgers']] as const).map(([id, label]) => <button type="button" key={id} className={accountingStage === id ? 'active' : ''} onClick={() => setAccountingStage(id)}>{label}</button>)}
      </section> : null}
      {section === "purchase" ? <section className="setup-panel compact-summary"><h2>Purchase summary</h2><PurchaseReadinessGrid purchaseSummary={purchaseSummary} /></section> : null}
      {section === "sales" ? <section className="setup-panel compact-summary"><h2>Sales summary</h2><SalesReadinessGrid salesSummary={salesSummary} /></section> : null}
      {section === "payments" ? <section className="setup-panel compact-summary"><h2>Payment summary</h2><PaymentReadinessGrid paymentSummary={paymentSummary} /></section> : null}
      {section === "accounting" ? <>
        <section className="setup-panel compact-summary"><h2>Accounting summary</h2><AccountingReadinessGrid accountingSummary={accountingSummary} /></section>
        <section className="setup-panel compact-summary"><h2>Ledger and GST</h2><ReportReadinessGrid partyLedgerSummary={partyLedgerSummary} gstSummary={gstSummary} /></section>
      </> : null}
      <section className="masters-grid">
        {section === "purchase" && purchaseStage === "order" ? <PurchaseOrderPanel
          items={purchaseOrders.data ?? []}
          suppliers={suppliers.data ?? []}
          variants={variants.data ?? []}
        /> : null}
        {section === "purchase" && purchaseStage === "grn" ? <GoodsReceiptNotePanel
          items={grns.data ?? []}
          orders={purchaseOrders.data ?? []}
          suppliers={suppliers.data ?? []}
          variants={variants.data ?? []}
          warehouses={warehouses.data ?? []}
        /> : null}
        {section === "purchase" && purchaseStage === "invoice" ? <PurchaseInvoicePanel
          grns={grns.data ?? []}
          invoices={purchaseInvoices.data ?? []}
          suppliers={suppliers.data ?? []}
          variants={variants.data ?? []}
          warehouses={warehouses.data ?? []}
        /> : null}
        {section === "purchase" && purchaseStage === "return" ? <PurchaseReturnPanel invoices={purchaseInvoices.data ?? []} items={purchaseReturns.data ?? []} /> : null}
        {section === "sales" && salesStage === "quote" ? <SalesQuotationPanel customers={customers.data ?? []} items={salesQuotations.data ?? []} variants={variants.data ?? []} /> : null}
        {section === "sales" && salesStage === "order" ? <SalesOrderPanel customers={customers.data ?? []} items={salesOrders.data ?? []} quotations={salesQuotations.data ?? []} variants={variants.data ?? []} /> : null}
        {section === "sales" && salesStage === "delivery" ? <DeliveryChallanPanel customers={customers.data ?? []} items={deliveryChallans.data ?? []} orders={salesOrders.data ?? []} variants={variants.data ?? []} warehouses={warehouses.data ?? []} /> : null}
        {section === "sales" && salesStage === "invoice" ? <SalesInvoicePanel
          company={invoiceCompany.data}
          customers={customers.data ?? []}
          deliveryChallans={deliveryChallans.data ?? []}
          invoices={salesInvoices.data ?? []}
          orders={salesOrders.data ?? []}
          variants={variants.data ?? []}
          warehouses={warehouses.data ?? []}
        /> : null}
        {section === "sales" && salesStage === "return" ? <SalesReturnPanel invoices={salesInvoices.data ?? []} items={salesReturns.data ?? []} /> : null}
        {section === "accounting" && accountingStage === "accounts" ? <AccountPanel items={accounts.data ?? []} /> : null}
        {section === "accounting" && accountingStage === "journals" ? <><JournalPanel accounts={accounts.data ?? []} items={journalEntries.data ?? []} /><ContraVoucherPanel accounts={accounts.data ?? []} /></> : null}
        {section === "accounting" && accountingStage === "statements" ? <><TrialBalancePanel trialBalance={trialBalance.data} /><ProfitAndLossPanel statement={profitAndLoss.data} /><BalanceSheetPanel statement={balanceSheet.data} /></> : null}
        {section === "accounting" && accountingStage === "ledger" ? <><GeneralLedgerPanel items={generalLedger.data ?? []} /><PartyLedgerPanel items={partyLedger.data ?? []} /></> : null}
        {section === "payments" && paymentStage === "payment" ? <PaymentPanel
          customers={customers.data ?? []}
          items={payments.data ?? []}
          paymentModes={paymentModes.data ?? []}
          suppliers={suppliers.data ?? []}
        /> : null}
        {section === "payments" && paymentStage === "notes" ? <FinancialNotePanel customers={customers.data ?? []} items={notes.data ?? []} suppliers={suppliers.data ?? []} /> : null}
        {section === "payments" && paymentStage === "outstanding" ? <><OutstandingPanel outstanding={outstanding.data} /><PartyLedgerPanel items={partyLedger.data ?? []} /></> : null}
      </section>
      <ModuleGrid filter={["Purchase", "Sales", "Workshop", "Accounting"]} />
    </>
  );
}

function ReportsView({
  accountingSummary,
  gstSummary,
  inventorySummary,
  partyLedgerSummary,
  purchaseSummary,
  salesSummary,
  workshopSummary,
}: {
  accountingSummary?: AccountingSummary;
  gstSummary?: GstSummary;
  inventorySummary?: InventorySummary;
  partyLedgerSummary?: PartyLedgerSummary;
  purchaseSummary?: PurchaseSummary;
  salesSummary?: SalesSummary;
  workshopSummary?: WorkshopSummary;
}) {
  const [gstFilters, setGstFilters] = useState({ from: "", to: "" });
  const auditLogs = useAuditLogs();
  const filteredGstSummary = useFilteredGstSummary(gstFilters);
  const gstRegisters = useGstRegisters(gstFilters);
  const balanceSheet = useQuery({
    queryKey: ["balance-sheet"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<BalanceSheet>>("/accounting/balance-sheet");
      return response.data.data;
    },
  });
  const profitAndLoss = useQuery({
    queryKey: ["profit-and-loss"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<ProfitAndLoss>>("/accounting/profit-and-loss");
      return response.data.data;
    },
  });
  const trialBalance = useQuery({
    queryKey: ["trial-balance"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<TrialBalance>>("/accounting/trial-balance");
      return response.data.data;
    },
  });
  const outstanding = usePartyOutstanding();
  const reorderItems = useMasterList<ReorderItem>("reorder-items", "/inventory/reorder-items");

  return (
    <>
      <section className="view-header">
        <h2>Reports</h2>
        <p>Financial, GST, inventory, party outstanding, workshop, and audit reporting for posted business activity.</p>
      </section>

      <section className="reports-grid">
        <article className="setup-panel wide-panel">
          <h2>Business Snapshot</h2>
          <div className="readiness-grid">
            <ReadinessMetric label="Net Purchase" value={purchaseSummary?.grandTotal} />
            <ReadinessMetric label="Net Sales" value={salesSummary?.grandTotal} />
            <ReadinessMetric label="COGS" value={salesSummary?.costOfGoodsSold} />
            <ReadinessMetric label="Stock Value" value={inventorySummary?.stockValue} />
            <ReadinessMetric label="Posted Journals" value={accountingSummary?.postedJournals} />
            <ReadinessMetric label="Debit Total" value={accountingSummary?.debitTotal} />
            <ReadinessMetric label="Credit Total" value={accountingSummary?.creditTotal} />
            <ReadinessMetric label="Customer Balance" value={partyLedgerSummary?.customerBalance} />
            <ReadinessMetric label="Supplier Balance" value={partyLedgerSummary?.supplierBalance} />
            <ReadinessMetric label="GST Payable" value={gstSummary?.netPayable} />
            <ReadinessMetric label="Open Jobs" value={workshopSummary?.open} />
          </div>
        </article>

        <ProfitAndLossPanel statement={profitAndLoss.data} />
        <BalanceSheetPanel statement={balanceSheet.data} />
        <TrialBalancePanel trialBalance={trialBalance.data} />

        <GstRegisterPanel
          filters={gstFilters}
          registers={gstRegisters.data}
          summary={filteredGstSummary.data ?? gstSummary}
          onFilterChange={setGstFilters}
        />

        <OutstandingPanel outstanding={outstanding.data} />

        <section className="setup-panel">
          <h2>Low Stock and Reorder</h2>
          <MasterList
            items={(reorderItems.data ?? []).map((item) => ({
              id: item.product.id,
              label: `${item.product.code} / ${item.product.name}`,
              meta: `${item.availableQuantity} ${item.unit.symbol} available / shortage ${item.shortageQuantity}`,
            }))}
          />
        </section>

        <AuditLogPanel items={auditLogs.data ?? []} />
      </section>
    </>
  );
}

function csvValue(value: unknown) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function exportGstRows(fileName: string, rows: GstRegisterRow[]) {
  const headers = [
    "Document Date",
    "Document Type",
    "Document Number",
    "Module",
    "Party",
    "GSTIN",
    "Tax Mode",
    "HSN Codes",
    "Taxable",
    "CGST",
    "SGST",
    "IGST",
    "Total Tax",
    "Grand Total",
  ];
  const body = rows.map((row) => [
    row.documentDate.slice(0, 10),
    row.documentType,
    row.documentNumber,
    row.module,
    row.partyName,
    row.partyGstin ?? "",
    row.taxMode,
    row.hsnCodes,
    row.taxableAmount,
    row.cgstAmount,
    row.sgstAmount,
    row.igstAmount,
    row.totalTaxAmount,
    row.grandTotal,
  ]);
  const csv = [headers, ...body].map((line) => line.map(csvValue).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function GstRegisterPanel({
  filters,
  onFilterChange,
  registers,
  summary,
}: {
  filters: { from: string; to: string };
  onFilterChange: (filters: { from: string; to: string }) => void;
  registers?: GstRegisters;
  summary?: GstSummary;
}) {
  const inputRows = registers?.inputRows ?? [];
  const outputRows = registers?.outputRows ?? [];

  return (
    <section className="setup-panel wide-panel">
      <h2>GST Registers</h2>
      <form className="compact-form" onSubmit={(event) => event.preventDefault()}>
        <input type="date" value={filters.from} onChange={(event) => onFilterChange({ ...filters, from: event.target.value })} />
        <input type="date" value={filters.to} onChange={(event) => onFilterChange({ ...filters, to: event.target.value })} />
        <Button type="button" variant="outline" onClick={() => onFilterChange({ from: "", to: "" })}>
          Clear
        </Button>
        <Button type="button" variant="outline" disabled={inputRows.length === 0} onClick={() => exportGstRows("rams-gst-input-register.csv", inputRows)}>
          Export Input
        </Button>
        <Button type="button" variant="outline" disabled={outputRows.length === 0} onClick={() => exportGstRows("rams-gst-output-register.csv", outputRows)}>
          Export Output
        </Button>
        <Button type="button" variant="outline" disabled={outputRows.length === 0} onClick={() => downloadCsv(`/accounting/gstr-1.csv${gstDateParams(filters)}`)}>
          GSTR-1
        </Button>
        <Button type="button" variant="outline" disabled={inputRows.length === 0} onClick={() => downloadCsv(`/accounting/gstr-2.csv${gstDateParams(filters)}`)}>
          GSTR-2
        </Button>
      </form>
      <div className="readiness-grid">
        <ReadinessMetric label="Input CGST" value={summary?.inputCgst} />
        <ReadinessMetric label="Input SGST" value={summary?.inputSgst} />
        <ReadinessMetric label="Input IGST" value={summary?.inputIgst} />
        <ReadinessMetric label="Output CGST" value={summary?.outputCgst} />
        <ReadinessMetric label="Output SGST" value={summary?.outputSgst} />
        <ReadinessMetric label="Output IGST" value={summary?.outputIgst} />
        <ReadinessMetric label="Input Tax" value={summary?.inputTax} />
        <ReadinessMetric label="Output Tax" value={summary?.outputTax} />
        <ReadinessMetric label="Net Payable" value={summary?.netPayable} />
      </div>
      <div className="split-list-grid">
        <GstRegisterList title="Input Register" rows={inputRows} />
        <GstRegisterList title="Output Register" rows={outputRows} />
      </div>
    </section>
  );
}

function GstRegisterList({ rows, title }: { rows: GstRegisterRow[]; title: string }) {
  return (
    <article className="inline-panel">
      <h3>{title}</h3>
      <MasterList
        items={rows.slice(0, 12).map((row) => ({
          id: row.id,
          label: `${row.documentNumber} / ${row.partyName}`,
          meta: `${row.documentDate.slice(0, 10)} / ${row.documentType} / HSN ${row.hsnCodes.join(", ") || "-"} / Tax ${row.totalTaxAmount} / Total ${row.grandTotal}`,
        }))}
      />
    </article>
  );
}

function SettingsView({
  company,
  auditLogs,
  financialYears,
  numberSeries,
}: {
  company?: Company;
  auditLogs: AuditLog[];
  financialYears: FinancialYear[];
  numberSeries: NumberSeries[];
}) {
  const [section, setSection] = useState<"business" | "documents" | "security" | "approvals" | "audit">("business");
  const roles = useMasterList<AdminRole>("auth-roles", "/auth/roles");
  const users = useMasterList<AdminUser>("auth-users", "/auth/users");
  const approvalRules = useMasterList<ApprovalRule>("approval-rules", "/approvals/rules");
  const approvalRequests = useMasterList<ApprovalRequest>("approval-requests", "/approvals/requests");

  return (
    <>
      <section className="view-header">
        <div>
          <p className="section-kicker">Control centre</p>
          <h2>Configuration</h2>
          <p>Manage the business identity, operational rules, access control and compliance from one place.</p>
        </div>
      </section>
      <section className="section-tabs settings-tabs" aria-label="Configuration categories">
        {([
          ["business", "Business profile", "Identity, tax and address"],
          ["documents", "Documents", "Financial year and numbering"],
          ["security", "Users & security", "Roles and access posture"],
          ["approvals", "Approvals", "Flexible control rules"],
          ["audit", "Audit trail", "Accountability and history"],
        ] as const).map(([id, label, description]) => (
          <button key={id} type="button" className={section === id ? "active" : ""} onClick={() => setSection(id)}>
            <strong>{label}</strong><span>{description}</span>
          </button>
        ))}
      </section>
      <section className="foundation-grid configuration-grid" aria-label="Configuration workspace">
        {section === "business" ? <CompanyProfilePanel company={company} /> : null}
        {section === "documents" ? <><FinancialYearPanel financialYears={financialYears} /><NumberSeriesPanel numberSeries={numberSeries} /></> : null}
        {section === "security" ? <><SecurityPosturePanel users={users.data ?? []} roles={roles.data ?? []} /><UserRolePanel roles={roles.data ?? []} users={users.data ?? []} /></> : null}
        {section === "approvals" ? <ApprovalWorkflowPanel requests={approvalRequests.data ?? []} rules={approvalRules.data ?? []} /> : null}
        {section === "audit" ? <AuditLogPanel items={auditLogs} /> : null}
      </section>
    </>
  );
}

function CompanyProfilePanel({ company }: { company?: Company }) {
  const [form, setForm] = useState({
    name: "", legalName: "", gstin: "", pan: "", tan: "", phone: "", email: "",
    addressLine1: "", addressLine2: "", city: "", state: "", pincode: "",
  });

  useEffect(() => {
    if (!company) return;
    setForm({
      name: company.name ?? "", legalName: company.legalName ?? "", gstin: company.gstin ?? "",
      pan: company.pan ?? "", tan: company.tan ?? "", phone: company.phone ?? "", email: company.email ?? "",
      addressLine1: company.addressLine1 ?? "", addressLine2: company.addressLine2 ?? "",
      city: company.city ?? "", state: company.state ?? "", pincode: company.pincode ?? "",
    });
  }, [company]);

  const mutation = useMutation({
    mutationFn: async () => { await api.patch("/company", form); },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["company"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
    },
  });

  return (
    <article className="setup-panel wide-panel">
      <div className="panel-heading">
        <div><p className="section-kicker dark">Business identity</p><h2>Company profile</h2></div>
        <span className="context-note">Used on invoices, GST reports and statutory documents.</span>
      </div>
      <form className="labeled-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        <label className="form-field"><span>Business name *</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className="form-field"><span>Legal name</span><input value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} /></label>
        <label className="form-field"><span>GSTIN</span><input maxLength={15} placeholder="24ABCDE1234F1Z5" value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value.toUpperCase() })} /></label>
        <label className="form-field"><span>PAN</span><input maxLength={10} placeholder="ABCDE1234F" value={form.pan} onChange={(event) => setForm({ ...form, pan: event.target.value.toUpperCase() })} /></label>
        <label className="form-field"><span>TAN</span><input value={form.tan} onChange={(event) => setForm({ ...form, tan: event.target.value.toUpperCase() })} /></label>
        <label className="form-field"><span>Phone</span><input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label className="form-field"><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="form-field field-span-2"><span>Address line 1</span><input value={form.addressLine1} onChange={(event) => setForm({ ...form, addressLine1: event.target.value })} /></label>
        <label className="form-field field-span-2"><span>Address line 2</span><input value={form.addressLine2} onChange={(event) => setForm({ ...form, addressLine2: event.target.value })} /></label>
        <label className="form-field"><span>City</span><input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
        <label className="form-field"><span>State</span><input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} /></label>
        <label className="form-field"><span>Pincode</span><input inputMode="numeric" value={form.pincode} onChange={(event) => setForm({ ...form, pincode: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : "Save company profile"}</Button></div>
      </form>
    </article>
  );
}

function SecurityPosturePanel({ users, roles }: { users: AdminUser[]; roles: AdminRole[] }) {
  return (
    <article className="setup-panel wide-panel security-panel">
      <div className="panel-heading"><div><p className="section-kicker dark">Security posture</p><h2>Access protection</h2></div><span className="security-status">Operational</span></div>
      <div className="security-grid">
        <div><strong>HTTP-only sessions</strong><span>Browser scripts cannot read authentication cookies.</span></div>
        <div><strong>Role-based access</strong><span>{`${roles.length} active roles control module permissions.`}</span></div>
        <div><strong>Login protection</strong><span>Rate limiting and temporary lockout protect repeated attempts.</span></div>
        <div><strong>Audit accountability</strong><span>{`${users.length} active user records are tied to auditable actions.`}</span></div>
      </div>
    </article>
  );
}

function ApprovalWorkflowPanel({ requests, rules }: { requests: ApprovalRequest[]; rules: ApprovalRule[] }) {
  const [form, setForm] = useState({
    module: "purchase",
    documentType: "PURCHASE_INVOICE",
    triggerAction: "POST",
    requireApproval: false,
    minimumAmount: "",
  });
  const [decisionNotes, setDecisionNotes] = useState("");
  const saveRuleMutation = useMutation({
    mutationFn: async () => {
      await api.post("/approvals/rules", form);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["approval-rules"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
    },
  });
  const decisionMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: string }) => {
      await api.post(`/approvals/requests/${id}/decision`, { decision, decisionNotes });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["approval-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["goods-receipt-notes"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-quotations"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["delivery-challans"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
      setDecisionNotes("");
    },
  });

  return (
    <article className="setup-panel wide-panel">
      <h2>Approval Workflow</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        saveRuleMutation.mutate();
      }}>
        <select value={form.module} onChange={(event) => setForm({ ...form, module: event.target.value })}>
          <option value="purchase">Purchase</option>
          <option value="sales">Sales</option>
          <option value="workshop">Workshop</option>
          <option value="accounting">Accounting</option>
        </select>
        <input placeholder="Document type" value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value })} />
        <select value={form.triggerAction} onChange={(event) => setForm({ ...form, triggerAction: event.target.value })}>
          <option value="CREATE">Create</option>
          <option value="APPROVE">Approve</option>
          <option value="POST">Post</option>
          <option value="CANCEL">Cancel</option>
        </select>
        <label className="checkbox-field">
          <input type="checkbox" checked={form.requireApproval} onChange={(event) => setForm({ ...form, requireApproval: event.target.checked })} />
          Required
        </label>
        <input placeholder="Minimum amount" value={form.minimumAmount} onChange={(event) => setForm({ ...form, minimumAmount: event.target.value })} />
        <Button type="submit" variant="outline" disabled={saveRuleMutation.isPending}>Save Rule</Button>
      </form>
      <div className="split-list-grid">
        <article className="inline-panel">
          <h3>Rules</h3>
          <MasterList
            items={rules.map((rule) => ({
              id: rule.id,
              label: `${rule.module} / ${rule.documentType}`,
              meta: `${rule.triggerAction} / ${rule.requireApproval ? "Approval required" : "No approval"} / Min ${rule.minimumAmount ?? 0} / ${rule.status}`,
            }))}
          />
        </article>
        <article className="inline-panel">
          <h3>Requests</h3>
          <input className="list-search" placeholder="Decision notes" value={decisionNotes} onChange={(event) => setDecisionNotes(event.target.value)} />
          <ul className="compact-list action-list">
            {requests.length === 0 ? <li><span>No records yet.</span></li> : null}
            {requests.slice(0, 8).map((request) => (
              <li key={request.id}>
                <span>{`${request.documentNumber} / ${request.documentType}`}</span>
                <strong>{`${request.module} / ${request.requestedAction} / ${request.status} / ${request.amount ?? 0}`}</strong>
                {request.status === "PENDING" ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => decisionMutation.mutate({ id: request.id, decision: "APPROVED" })}>
                      Approve
                    </Button>
                    <Button type="button" variant="outline" onClick={() => decisionMutation.mutate({ id: request.id, decision: "REJECTED" })}>
                      Reject
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </article>
  );
}

function UserRolePanel({ roles, users }: { roles: AdminRole[]; users: AdminUser[] }) {
  const [form, setForm] = useState({ userId: "", roleId: "" });
  const mutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/auth/users/${form.userId}/roles`, { roleIds: [form.roleId] });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth-users"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
      setForm({ userId: "", roleId: "" });
    },
  });

  return (
    <article className="setup-panel wide-panel">
      <h2>User Access</h2>
      <form className="inline-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <select value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })}>
          <option value="">User</option>
          {users.map((user) => <option key={user.id} value={user.id}>{`${user.username} / ${user.fullName}`}</option>)}
        </select>
        <select value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })}>
          <option value="">Role</option>
          {roles.map((role) => <option key={role.id} value={role.id}>{`${role.code} / ${role.name}`}</option>)}
        </select>
        <Button type="submit" variant="outline" disabled={mutation.isPending || !form.userId || !form.roleId}>Assign</Button>
      </form>
      <MasterList
        items={users.map((user) => ({
          id: user.id,
          label: `${user.username} / ${user.status}`,
          meta: user.userRoles.map((userRole) => userRole.role.code).join(", ") || "No role",
        }))}
      />
    </article>
  );
}

function MasterReadinessGrid({ masterSummary }: { masterSummary?: MasterSummary }) {
  return (
    <div className="readiness-grid">
      <ReadinessMetric label="Units" value={masterSummary?.units} />
      <ReadinessMetric label="HSN Codes" value={masterSummary?.hsnCodes} />
      <ReadinessMetric label="Tax Rates" value={masterSummary?.taxRates} />
      <ReadinessMetric label="Brands" value={masterSummary?.brands} />
      <ReadinessMetric label="Categories" value={masterSummary?.categories} />
      <ReadinessMetric label="Sub-categories" value={masterSummary?.subCategories} />
      <ReadinessMetric label="Products" value={masterSummary?.products} />
      <ReadinessMetric label="Warehouses" value={masterSummary?.warehouses} />
    </div>
  );
}

function InventoryReadinessGrid({ inventorySummary }: { inventorySummary?: InventorySummary }) {
  return (
    <div className="readiness-grid">
      <ReadinessMetric label="Stock Items" value={inventorySummary?.stockItems} />
      <ReadinessMetric label="Movements" value={inventorySummary?.movementCount} />
      <ReadinessMetric label="Total Quantity" value={inventorySummary?.totalQuantity} />
      <ReadinessMetric label="Stock Value" value={inventorySummary?.stockValue} />
    </div>
  );
}

function CommercialReadinessGrid({
  commercialMasterSummary,
}: {
  commercialMasterSummary?: CommercialMasterSummary;
}) {
  return (
    <div className="readiness-grid">
      <ReadinessMetric label="Customers" value={commercialMasterSummary?.customers} />
      <ReadinessMetric label="Suppliers" value={commercialMasterSummary?.suppliers} />
      <ReadinessMetric label="Employees" value={commercialMasterSummary?.employees} />
      <ReadinessMetric label="Vehicles" value={commercialMasterSummary?.vehicles} />
      <ReadinessMetric label="Payment Modes" value={commercialMasterSummary?.paymentModes} />
    </div>
  );
}

function AccountingReadinessGrid({ accountingSummary }: { accountingSummary?: AccountingSummary }) {
  return (
    <div className="readiness-grid">
      <ReadinessMetric label="Accounts" value={accountingSummary?.accounts} />
      <ReadinessMetric label="Posted Journals" value={accountingSummary?.postedJournals} />
      <ReadinessMetric label="Debit Total" value={accountingSummary?.debitTotal} />
      <ReadinessMetric label="Credit Total" value={accountingSummary?.creditTotal} />
    </div>
  );
}

function PurchaseReadinessGrid({ purchaseSummary }: { purchaseSummary?: PurchaseSummary }) {
  return (
    <div className="readiness-grid">
      <ReadinessMetric label="Approved Orders" value={purchaseSummary?.approvedOrders} />
      <ReadinessMetric label="Approved GRNs" value={purchaseSummary?.approvedGrns} />
      <ReadinessMetric label="Posted Invoices" value={purchaseSummary?.postedInvoices} />
      <ReadinessMetric label="Posted Returns" value={purchaseSummary?.postedReturns} />
      <ReadinessMetric label="Gross Purchase" value={purchaseSummary?.grossGrandTotal} />
      <ReadinessMetric label="Return Value" value={purchaseSummary?.returnGrandTotal} />
      <ReadinessMetric label="Net Purchase" value={purchaseSummary?.grandTotal} />
      <ReadinessMetric label="Net GST Input" value={purchaseSummary?.totalTaxAmount} />
    </div>
  );
}

function SalesReadinessGrid({ salesSummary }: { salesSummary?: SalesSummary }) {
  return (
    <div className="readiness-grid">
      <ReadinessMetric label="Approved Quotes" value={salesSummary?.approvedQuotations} />
      <ReadinessMetric label="Approved Orders" value={salesSummary?.approvedOrders} />
      <ReadinessMetric label="Approved Challans" value={salesSummary?.approvedChallans} />
      <ReadinessMetric label="Posted Invoices" value={salesSummary?.postedInvoices} />
      <ReadinessMetric label="Posted Returns" value={salesSummary?.postedReturns} />
      <ReadinessMetric label="Gross Sales" value={salesSummary?.grossGrandTotal} />
      <ReadinessMetric label="Return Value" value={salesSummary?.returnGrandTotal} />
      <ReadinessMetric label="Net Sales" value={salesSummary?.grandTotal} />
      <ReadinessMetric label="Net COGS" value={salesSummary?.costOfGoodsSold} />
    </div>
  );
}

function ReportReadinessGrid({
  gstSummary,
  partyLedgerSummary,
}: {
  gstSummary?: GstSummary;
  partyLedgerSummary?: PartyLedgerSummary;
}) {
  return (
    <div className="readiness-grid">
      <ReadinessMetric label="Customer Balance" value={partyLedgerSummary?.customerBalance} />
      <ReadinessMetric label="Supplier Balance" value={partyLedgerSummary?.supplierBalance} />
      <ReadinessMetric label="GST Input" value={gstSummary?.inputTax} />
      <ReadinessMetric label="GST Output" value={gstSummary?.outputTax} />
      <ReadinessMetric label="Net GST Payable" value={gstSummary?.netPayable} />
    </div>
  );
}

function PaymentReadinessGrid({ paymentSummary }: { paymentSummary?: PaymentSummary }) {
  return (
    <div className="readiness-grid">
      <ReadinessMetric label="Receipts" value={paymentSummary?.receipts} />
      <ReadinessMetric label="Payments" value={paymentSummary?.payments} />
      <ReadinessMetric label="Receipt Total" value={paymentSummary?.receiptTotal} />
      <ReadinessMetric label="Payment Total" value={paymentSummary?.paymentTotal} />
    </div>
  );
}

function WorkshopReadinessGrid({ workshopSummary }: { workshopSummary?: WorkshopSummary }) {
  return (
    <div className="readiness-grid">
      <ReadinessMetric label="Open" value={workshopSummary?.open} />
      <ReadinessMetric label="In Progress" value={workshopSummary?.inProgress} />
      <ReadinessMetric label="Ready" value={workshopSummary?.ready} />
      <ReadinessMetric label="Delivered" value={workshopSummary?.delivered} />
    </div>
  );
}

function ModuleGrid({ filter }: { filter?: string[] }) {
  const visibleModules = filter
    ? modules.filter((module) => filter.includes(module.name))
    : modules;

  return (
    <section className="module-grid" aria-label="RAMS modules">
      {visibleModules.map((module) => (
        <article className="module-card" key={module.name}>
          <div className="module-icon">{module.icon}</div>
          <div>
            <div className="module-title">
              <h2>{module.name}</h2>
              <span>{module.status}</span>
            </div>
            <p>{module.text}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function OpeningStockPanel({
  variants,
  warehouses,
}: {
  variants: ProductVariant[];
  warehouses: Warehouse[];
}) {
  const [form, setForm] = useState({
    productVariantId: "",
    warehouseId: "",
    quantity: "1",
    unitCost: "0",
    narration: "Opening stock",
  });
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/inventory/opening-stock", form);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-balances"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-movements"] }),
      ]);
      setForm({ ...form, quantity: "1", unitCost: "0", narration: "Opening stock" });
    },
  });

  return (
    <article className="setup-panel">
      <h2>Post Opening Stock</h2>
      <form
        className="compact-form product-form"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <select
          value={form.productVariantId}
          onChange={(event) => setForm({ ...form, productVariantId: event.target.value })}
        >
          <option value="">Product variant</option>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>
          ))}
        </select>
        <select
          value={form.warehouseId}
          onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}
        >
          <option value="">Warehouse</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
          ))}
        </select>
        <input
          placeholder="Quantity"
          value={form.quantity}
          onChange={(event) => setForm({ ...form, quantity: event.target.value })}
        />
        <input
          placeholder="Unit cost"
          value={form.unitCost}
          onChange={(event) => setForm({ ...form, unitCost: event.target.value })}
        />
        <input
          placeholder="Narration"
          value={form.narration}
          onChange={(event) => setForm({ ...form, narration: event.target.value })}
        />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>
          Post
        </Button>
      </form>
    </article>
  );
}

function PurchaseOrderPanel({
  items,
  suppliers,
  variants,
}: {
  items: PurchaseOrder[];
  suppliers: Supplier[];
  variants: ProductVariant[];
}) {
  const [form, setForm] = useState({
    supplierId: "",
    productVariantId: "",
    orderDate: new Date().toISOString().slice(0, 10),
    expectedDate: "",
    quantity: "1",
    unitCost: "0",
    narration: "Purchase order",
  });
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/purchase/orders", {
        supplierId: form.supplierId,
        orderDate: form.orderDate,
        expectedDate: form.expectedDate,
        narration: form.narration,
        lines: [{ productVariantId: form.productVariantId, quantity: form.quantity, unitCost: form.unitCost }],
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
      setForm({ ...form, productVariantId: "", quantity: "1", unitCost: "0", narration: "Purchase order" });
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-heading"><div><p className="section-kicker dark">Purchase · Step 1</p><h2>Create purchase order</h2></div><span className="context-note">Confirms what you intend to buy. Stock and accounts are not changed yet.</span></div>
      <form className="labeled-form transaction-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <label className="form-field"><span>Supplier *</span><select required value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}>
          <option value="">Supplier</option>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select></label>
        <label className="form-field"><span>Product variant *</span><select required
          value={form.productVariantId}
          onChange={(event) => setForm({
            ...form,
            productVariantId: event.target.value,
            unitCost: costForVariant(variants, event.target.value),
          })}
        >
          <option value="">Product variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select></label>
        <label className="form-field"><span>Order date *</span><input required type="date" value={form.orderDate} onChange={(event) => setForm({ ...form, orderDate: event.target.value })} /></label>
        <label className="form-field"><span>Expected delivery</span><input type="date" value={form.expectedDate} onChange={(event) => setForm({ ...form, expectedDate: event.target.value })} /></label>
        <label className="form-field"><span>Quantity *</span><input required inputMode="decimal" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
        <label className="form-field"><span>Unit cost *</span><input required inputMode="decimal" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} /></label>
        <label className="form-field field-span-2"><span>Narration</span><input value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating..." : "Create purchase order"}</Button></div>
      </form>
      <MasterList
        items={items.map((order) => ({
          id: order.id,
          label: order.orderNumber,
          meta: `${order.supplier.name} / ${order.receiptStatus ?? order.status} / ${order.receivedQuantity ?? 0} of ${order.orderedQuantity ?? "-"} received / ${order.grandTotal}`,
        }))}
      />
    </article>
  );
}

function GoodsReceiptNotePanel({
  items,
  orders,
  suppliers,
  variants,
  warehouses,
}: {
  items: GoodsReceiptNote[];
  orders: PurchaseOrder[];
  suppliers: Supplier[];
  variants: ProductVariant[];
  warehouses: Warehouse[];
}) {
  const [form, setForm] = useState({
    supplierId: "",
    purchaseOrderId: "",
    warehouseId: "",
    productVariantId: "",
    grnDate: new Date().toISOString().slice(0, 10),
    quantity: "1",
    narration: "Goods receipt note",
  });
  const supplierOrders = orders.filter((order) => !form.supplierId || order.supplier.id === form.supplierId);
  const selectedOrder = orders.find((order) => order.id === form.purchaseOrderId);
  const conversionLines = selectedOrder?.lines.map((line) => ({
    productVariantId: line.productVariant.id,
    quantity: line.quantity,
  }));
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/purchase/grns", {
        supplierId: form.supplierId,
        purchaseOrderId: form.purchaseOrderId,
        warehouseId: form.warehouseId,
        grnDate: form.grnDate,
        narration: form.narration,
        lines: conversionLines?.length ? conversionLines : [{ productVariantId: form.productVariantId, quantity: form.quantity }],
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["goods-receipt-notes"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
      setForm({ ...form, purchaseOrderId: "", productVariantId: "", quantity: "1", narration: "Goods receipt note" });
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-heading"><div><p className="section-kicker dark">Purchase · Step 2</p><h2>Record goods receipt</h2></div><span className="context-note">Use a PO where possible. The receipt remains traceable to the original order.</span></div>
      <form className="labeled-form transaction-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <label className="form-field"><span>Supplier *</span><select required value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value, purchaseOrderId: "" })}>
          <option value="">Supplier</option>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select></label>
        <label className="form-field"><span>Purchase order</span><select
          value={form.purchaseOrderId}
          onChange={(event) => {
            const order = orders.find((item) => item.id === event.target.value);
            setForm({
              ...form,
              supplierId: order?.supplier.id ?? form.supplierId,
              purchaseOrderId: event.target.value,
              productVariantId: "",
              quantity: "1",
            });
          }}
        >
          <option value="">No purchase order</option>
          {supplierOrders.map((order) => <option key={order.id} value={order.id}>{`${order.orderNumber} / ${order.grandTotal}`}</option>)}
        </select></label>
        <label className="form-field"><span>Receiving warehouse *</span><select required value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}>
          <option value="">Warehouse</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select></label>
        <label className="form-field"><span>Product variant</span><select value={form.productVariantId} onChange={(event) => setForm({ ...form, productVariantId: event.target.value })}>
          <option value="">Product variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select></label>
        <label className="form-field"><span>Receipt date *</span><input required type="date" value={form.grnDate} onChange={(event) => setForm({ ...form, grnDate: event.target.value })} /></label>
        <label className="form-field"><span>Quantity</span><input inputMode="decimal" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
        <label className="form-field field-span-2"><span>Narration</span><input value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Recording..." : "Create goods receipt"}</Button></div>
      </form>
      {conversionLines?.length ? <p className="empty-text">{conversionLines.length} purchase order line(s) will be copied.</p> : null}
      <MasterList
        items={items.map((grn) => ({
          id: grn.id,
          label: grn.grnNumber,
          meta: `${grn.supplier.name} / ${grn.warehouse.name} / ${grn.invoiceStatus ?? grn.status} / ${grn.invoicedQuantity ?? 0} of ${grn.receivedQuantity ?? "-"} invoiced`,
        }))}
      />
    </article>
  );
}

function StockAdjustmentPanel({
  variants,
  warehouses,
}: {
  variants: ProductVariant[];
  warehouses: Warehouse[];
}) {
  const [form, setForm] = useState({
    adjustmentType: "IN",
    productVariantId: "",
    warehouseId: "",
    quantity: "1",
    unitCost: "0",
    narration: "Stock adjustment",
  });
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/inventory/stock-adjustments", form);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-balances"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-movements"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
      setForm({ ...form, quantity: "1", unitCost: "0", narration: "Stock adjustment" });
    },
  });

  return (
    <article className="setup-panel">
      <h2>Post Stock Adjustment</h2>
      <form
        className="compact-form product-form"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <select value={form.adjustmentType} onChange={(event) => setForm({ ...form, adjustmentType: event.target.value })}>
          <option value="IN">Increase stock</option>
          <option value="OUT">Reduce stock</option>
        </select>
        <select value={form.productVariantId} onChange={(event) => setForm({ ...form, productVariantId: event.target.value })}>
          <option value="">Product variant</option>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>
          ))}
        </select>
        <select value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}>
          <option value="">Warehouse</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
          ))}
        </select>
        <input placeholder="Quantity" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        <input placeholder="Unit cost" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} />
        <input placeholder="Narration" value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Post</Button>
      </form>
    </article>
  );
}

function StockTransferPanel({
  variants,
  warehouses,
}: {
  variants: ProductVariant[];
  warehouses: Warehouse[];
}) {
  const [form, setForm] = useState({
    productVariantId: "",
    fromWarehouseId: "",
    toWarehouseId: "",
    quantity: "1",
    narration: "Stock transfer",
  });
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/inventory/stock-transfers", form);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-balances"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-movements"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
      setForm({ ...form, quantity: "1", narration: "Stock transfer" });
    },
  });

  return (
    <article className="setup-panel">
      <h2>Post Stock Transfer</h2>
      <form
        className="compact-form product-form"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <select value={form.productVariantId} onChange={(event) => setForm({ ...form, productVariantId: event.target.value })}>
          <option value="">Product variant</option>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>
          ))}
        </select>
        <select value={form.fromWarehouseId} onChange={(event) => setForm({ ...form, fromWarehouseId: event.target.value })}>
          <option value="">From warehouse</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
          ))}
        </select>
        <select value={form.toWarehouseId} onChange={(event) => setForm({ ...form, toWarehouseId: event.target.value })}>
          <option value="">To warehouse</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
          ))}
        </select>
        <input placeholder="Quantity" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        <input placeholder="Narration" value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Post</Button>
      </form>
    </article>
  );
}

function SimpleCodeNamePanel({
  items,
  path,
  queryKeys,
  title,
}: {
  items: Array<{ id: string; code: string; name: string; status?: string }>;
  path: string;
  queryKeys: string[];
  title: string;
}) {
  const [form, setForm] = useState({ code: "", name: "" });
  const [editingId, setEditingId] = useState("");
  const mutation = useCreateMaster(path, queryKeys, () => setForm({ code: "", name: "" }));
  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`${path}/${editingId}`, form);
    },
    onSuccess: async () => {
      await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] })));
      setEditingId("");
      setForm({ code: "", name: "" });
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${path}/${id}`);
    },
    onSuccess: async () => {
      await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] })));
    },
  });

  return (
    <article className="setup-panel master-panel">
      <h2>{title}</h2>
      <form
        className="compact-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (editingId) {
            updateMutation.mutate();
            return;
          }
          mutation.mutate(form);
        }}
      >
        <input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending || updateMutation.isPending}>
          {editingId ? "Save" : "Add"}
        </Button>
        {editingId ? (
          <Button type="button" variant="outline" onClick={() => {
            setEditingId("");
            setForm({ code: "", name: "" });
          }}>
            Cancel
          </Button>
        ) : null}
      </form>
      <EditableMasterList
        items={items.map((item) => ({ id: item.id, label: item.name, meta: `${item.code} / ${item.status ?? "ACTIVE"}`, raw: item }))}
        onDeactivate={(id) => deactivateMutation.mutate(id)}
        onEdit={(item) => {
          setEditingId(item.id);
          setForm({ code: item.raw.code, name: item.raw.name });
        }}
      />
    </article>
  );
}

function CustomerPanel({ items }: { items: Customer[] }) {
  const emptyForm = { code: "", name: "", customerType: "Retail", phone: "", gstin: "", addressLine1: "", addressLine2: "", city: "", state: "", pincode: "", placeOfSupply: "", creditLimit: "0", creditDays: "0" };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pagedCustomers = usePagedMasterList<Customer>("customers-page", "/commercial-masters/customers/page", page, search);
  const displayCustomers = pagedCustomers.data?.items ?? items;
  const mutation = useCreateMaster("/commercial-masters/customers", ["customers", "commercial-master-summary", "party-outstanding"], () =>
    setForm(emptyForm),
  );
  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/commercial-masters/customers/${editingId}`, form);
    },
    onSuccess: async () => {
      await invalidateKeys(["customers", "customers-page", "commercial-master-summary", "party-outstanding"]);
      setEditingId("");
      setForm(emptyForm);
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/commercial-masters/customers/${id}`);
    },
    onSuccess: async () => {
      await invalidateKeys(["customers", "customers-page", "commercial-master-summary", "party-outstanding"]);
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-title-row">
        <h2>Customers</h2>
        <div className="button-row">
          <Button type="button" variant="outline" onClick={() => downloadCsv("/commercial-masters/customers/import-template.csv")}>Template</Button>
          <Button type="button" variant="outline" onClick={() => downloadCsv("/commercial-masters/customers/export.csv")}>Export CSV</Button>
        </div>
      </div>
      <form className="labeled-form transaction-form" onSubmit={(event) => {
        event.preventDefault();
        if (editingId) {
          updateMutation.mutate();
          return;
        }
        mutation.mutate(form);
      }}>
        <label className="form-field"><span>Customer code *</span><input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
        <label className="form-field"><span>Customer name *</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className="form-field"><span>Customer type</span><input value={form.customerType} onChange={(event) => setForm({ ...form, customerType: event.target.value })} /></label>
        <label className="form-field"><span>Phone</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label className="form-field"><span>GSTIN</span><input maxLength={15} value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value.toUpperCase() })} /></label>
        <label className="form-field field-span-2"><span>Billing address</span><input value={form.addressLine1} onChange={(event) => setForm({ ...form, addressLine1: event.target.value })} /></label>
        <label className="form-field field-span-2"><span>Address line 2</span><input value={form.addressLine2} onChange={(event) => setForm({ ...form, addressLine2: event.target.value })} /></label>
        <label className="form-field"><span>City</span><input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
        <label className="form-field"><span>State</span><input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} /></label>
        <label className="form-field"><span>Pincode</span><input inputMode="numeric" maxLength={12} value={form.pincode} onChange={(event) => setForm({ ...form, pincode: event.target.value })} /></label>
        <label className="form-field"><span>Place of supply</span><input value={form.placeOfSupply} onChange={(event) => setForm({ ...form, placeOfSupply: event.target.value })} /></label>
        <label className="form-field"><span>Credit limit</span><input type="number" min="0" step="0.01" value={form.creditLimit} onChange={(event) => setForm({ ...form, creditLimit: event.target.value })} /></label>
        <label className="form-field"><span>Credit days</span><input type="number" min="0" step="1" value={form.creditDays} onChange={(event) => setForm({ ...form, creditDays: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={mutation.isPending || updateMutation.isPending}>
          {editingId ? "Save customer" : "Add customer"}
        </Button>
        {editingId ? (
          <Button type="button" variant="outline" onClick={() => {
            setEditingId("");
            setForm(emptyForm);
          }}>
            Cancel
          </Button>
        ) : null}</div>
      </form>
      <PagedEditableMasterList
        isLoading={pagedCustomers.isLoading}
        page={pagedCustomers.data?.page ?? page}
        pageCount={pagedCustomers.data?.pageCount ?? 1}
        total={pagedCustomers.data?.total ?? displayCustomers.length}
        search={search}
        onSearchChange={setSearch}
        onPageChange={setPage}
        items={displayCustomers.map((item) => ({
          id: item.id,
          label: item.name,
          meta: `${item.code} / ${item.customerType} / Limit ${item.creditLimit ?? 0} / ${item.creditDays ?? 0} days / ${item.status ?? "ACTIVE"}`,
          raw: item,
        }))}
        onDeactivate={(id) => deactivateMutation.mutate(id)}
        onEdit={(item) => {
          setEditingId(item.id);
          setForm({
            code: item.raw.code,
            name: item.raw.name,
            customerType: item.raw.customerType,
            phone: item.raw.phone ?? "",
            gstin: item.raw.gstin ?? "",
            addressLine1: item.raw.addressLine1 ?? "",
            addressLine2: item.raw.addressLine2 ?? "",
            city: item.raw.city ?? "",
            state: item.raw.state ?? "",
            pincode: item.raw.pincode ?? "",
            placeOfSupply: item.raw.placeOfSupply ?? "",
            creditLimit: String(item.raw.creditLimit ?? 0),
            creditDays: String(item.raw.creditDays ?? 0),
          });
        }}
      />
    </article>
  );
}

function SupplierPanel({ items }: { items: Supplier[] }) {
  const [form, setForm] = useState({ code: "", name: "", supplierType: "Distributor", phone: "", gstin: "" });
  const [editingId, setEditingId] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pagedSuppliers = usePagedMasterList<Supplier>("suppliers-page", "/commercial-masters/suppliers/page", page, search);
  const displaySuppliers = pagedSuppliers.data?.items ?? items;
  const mutation = useCreateMaster("/commercial-masters/suppliers", ["suppliers", "commercial-master-summary"], () =>
    setForm({ code: "", name: "", supplierType: "Distributor", phone: "", gstin: "" }),
  );
  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/commercial-masters/suppliers/${editingId}`, form);
    },
    onSuccess: async () => {
      await invalidateKeys(["suppliers", "suppliers-page", "commercial-master-summary"]);
      setEditingId("");
      setForm({ code: "", name: "", supplierType: "Distributor", phone: "", gstin: "" });
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/commercial-masters/suppliers/${id}`);
    },
    onSuccess: async () => {
      await invalidateKeys(["suppliers", "suppliers-page", "commercial-master-summary"]);
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-title-row">
        <h2>Suppliers</h2>
        <div className="button-row">
          <Button type="button" variant="outline" onClick={() => downloadCsv("/commercial-masters/suppliers/import-template.csv")}>Template</Button>
          <Button type="button" variant="outline" onClick={() => downloadCsv("/commercial-masters/suppliers/export.csv")}>Export CSV</Button>
        </div>
      </div>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        if (editingId) {
          updateMutation.mutate();
          return;
        }
        mutation.mutate(form);
      }}>
        <input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="Type" value={form.supplierType} onChange={(event) => setForm({ ...form, supplierType: event.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <input placeholder="GSTIN" value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending || updateMutation.isPending}>
          {editingId ? "Save" : "Add"}
        </Button>
        {editingId ? (
          <Button type="button" variant="outline" onClick={() => {
            setEditingId("");
            setForm({ code: "", name: "", supplierType: "Distributor", phone: "", gstin: "" });
          }}>
            Cancel
          </Button>
        ) : null}
      </form>
      <PagedEditableMasterList
        isLoading={pagedSuppliers.isLoading}
        page={pagedSuppliers.data?.page ?? page}
        pageCount={pagedSuppliers.data?.pageCount ?? 1}
        total={pagedSuppliers.data?.total ?? displaySuppliers.length}
        search={search}
        onSearchChange={setSearch}
        onPageChange={setPage}
        items={displaySuppliers.map((item) => ({ id: item.id, label: item.name, meta: `${item.code} / ${item.supplierType} / ${item.status ?? "ACTIVE"}`, raw: item }))}
        onDeactivate={(id) => deactivateMutation.mutate(id)}
        onEdit={(item) => {
          setEditingId(item.id);
          setForm({
            code: item.raw.code,
            name: item.raw.name,
            supplierType: item.raw.supplierType,
            phone: item.raw.phone ?? "",
            gstin: item.raw.gstin ?? "",
          });
        }}
      />
    </article>
  );
}

function EmployeePanel({ items }: { items: Employee[] }) {
  const [form, setForm] = useState({ code: "", name: "", designation: "", department: "", phone: "" });
  const [editingId, setEditingId] = useState("");
  const mutation = useCreateMaster("/commercial-masters/employees", ["employees", "commercial-master-summary"], () =>
    setForm({ code: "", name: "", designation: "", department: "", phone: "" }),
  );
  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/commercial-masters/employees/${editingId}`, form);
    },
    onSuccess: async () => {
      await invalidateKeys(["employees", "commercial-master-summary"]);
      setEditingId("");
      setForm({ code: "", name: "", designation: "", department: "", phone: "" });
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/commercial-masters/employees/${id}`);
    },
    onSuccess: async () => {
      await invalidateKeys(["employees", "commercial-master-summary"]);
    },
  });

  return (
    <article className="setup-panel master-panel">
      <h2>Employees</h2>
      <form className="compact-form" onSubmit={(event) => {
        event.preventDefault();
        if (editingId) {
          updateMutation.mutate();
          return;
        }
        mutation.mutate(form);
      }}>
        <input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="Designation" value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} />
        <input placeholder="Department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending || updateMutation.isPending}>
          {editingId ? "Save" : "Add"}
        </Button>
        {editingId ? (
          <Button type="button" variant="outline" onClick={() => {
            setEditingId("");
            setForm({ code: "", name: "", designation: "", department: "", phone: "" });
          }}>
            Cancel
          </Button>
        ) : null}
      </form>
      <EditableMasterList
        items={items.map((item) => ({ id: item.id, label: item.name, meta: `${item.designation ?? item.code} / ${item.status ?? "ACTIVE"}`, raw: item }))}
        onDeactivate={(id) => deactivateMutation.mutate(id)}
        onEdit={(item) => {
          setEditingId(item.id);
          setForm({
            code: item.raw.code,
            name: item.raw.name,
            designation: item.raw.designation ?? "",
            department: item.raw.department ?? "",
            phone: item.raw.phone ?? "",
          });
        }}
      />
    </article>
  );
}

function PaymentModePanel({ items }: { items: PaymentMode[] }) {
  const [form, setForm] = useState({ code: "", name: "", paymentType: "Cash", requiresReference: false });
  const [editingId, setEditingId] = useState("");
  const mutation = useCreateMaster("/commercial-masters/payment-modes", ["payment-modes", "commercial-master-summary"], () =>
    setForm({ code: "", name: "", paymentType: "Cash", requiresReference: false }),
  );
  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/commercial-masters/payment-modes/${editingId}`, form);
    },
    onSuccess: async () => {
      await invalidateKeys(["payment-modes", "commercial-master-summary"]);
      setEditingId("");
      setForm({ code: "", name: "", paymentType: "Cash", requiresReference: false });
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/commercial-masters/payment-modes/${id}`);
    },
    onSuccess: async () => {
      await invalidateKeys(["payment-modes", "commercial-master-summary"]);
    },
  });

  return (
    <article className="setup-panel master-panel">
      <h2>Payment Modes</h2>
      <form className="compact-form" onSubmit={(event) => {
        event.preventDefault();
        if (editingId) {
          updateMutation.mutate();
          return;
        }
        mutation.mutate(form);
      }}>
        <input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <select value={form.paymentType} onChange={(event) => setForm({ ...form, paymentType: event.target.value })}>
          <option>Cash</option>
          <option>Bank</option>
          <option>UPI</option>
          <option>Card</option>
          <option>Cheque</option>
        </select>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.requiresReference}
            onChange={(event) => setForm({ ...form, requiresReference: event.target.checked })}
          />
          Reference
        </label>
        <Button type="submit" variant="outline" disabled={mutation.isPending || updateMutation.isPending}>
          {editingId ? "Save" : "Add"}
        </Button>
        {editingId ? (
          <Button type="button" variant="outline" onClick={() => {
            setEditingId("");
            setForm({ code: "", name: "", paymentType: "Cash", requiresReference: false });
          }}>
            Cancel
          </Button>
        ) : null}
      </form>
      <EditableMasterList
        items={items.map((item) => ({ id: item.id, label: item.name, meta: `${item.paymentType} / ${item.status ?? "ACTIVE"}`, raw: item }))}
        onDeactivate={(id) => deactivateMutation.mutate(id)}
        onEdit={(item) => {
          setEditingId(item.id);
          setForm({
            code: item.raw.code,
            name: item.raw.name,
            paymentType: item.raw.paymentType,
            requiresReference: Boolean(item.raw.requiresReference),
          });
        }}
      />
    </article>
  );
}

function VehiclePanel({ customers, items }: { customers: Customer[]; items: Vehicle[] }) {
  const [form, setForm] = useState({
    customerId: "",
    registrationNumber: "",
    brand: "",
    model: "",
    vehicleType: "Four-wheeler",
    fuelType: "",
  });
  const [editingId, setEditingId] = useState("");
  const mutation = useCreateMaster("/commercial-masters/vehicles", ["vehicles", "commercial-master-summary"], () =>
    setForm({ ...form, registrationNumber: "", brand: "", model: "", fuelType: "" }),
  );
  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/commercial-masters/vehicles/${editingId}`, form);
    },
    onSuccess: async () => {
      await invalidateKeys(["vehicles", "commercial-master-summary"]);
      setEditingId("");
      setForm({
        customerId: "",
        registrationNumber: "",
        brand: "",
        model: "",
        vehicleType: "Four-wheeler",
        fuelType: "",
      });
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/commercial-masters/vehicles/${id}`);
    },
    onSuccess: async () => {
      await invalidateKeys(["vehicles", "commercial-master-summary"]);
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Vehicles</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        if (editingId) {
          updateMutation.mutate();
          return;
        }
        mutation.mutate(form);
      }}>
        <select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}>
          <option value="">Walk-in / unassigned</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
        <input placeholder="Registration" value={form.registrationNumber} onChange={(event) => setForm({ ...form, registrationNumber: event.target.value })} />
        <input placeholder="Brand" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
        <input placeholder="Model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
        <input placeholder="Type" value={form.vehicleType} onChange={(event) => setForm({ ...form, vehicleType: event.target.value })} />
        <input placeholder="Fuel" value={form.fuelType} onChange={(event) => setForm({ ...form, fuelType: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending || updateMutation.isPending}>
          {editingId ? "Save" : "Add"}
        </Button>
        {editingId ? (
          <Button type="button" variant="outline" onClick={() => {
            setEditingId("");
            setForm({
              customerId: "",
              registrationNumber: "",
              brand: "",
              model: "",
              vehicleType: "Four-wheeler",
              fuelType: "",
            });
          }}>
            Cancel
          </Button>
        ) : null}
      </form>
      <EditableMasterList
        items={items.map((item) => ({
          id: item.id,
          label: item.registrationNumber,
          meta: `${item.brand} ${item.model}${item.customer ? ` / ${item.customer.name}` : ""} / ${item.status ?? "ACTIVE"}`,
          raw: item,
        }))}
        onDeactivate={(id) => deactivateMutation.mutate(id)}
        onEdit={(item) => {
          setEditingId(item.id);
          setForm({
            customerId: item.raw.customer?.id ?? "",
            registrationNumber: item.raw.registrationNumber,
            brand: item.raw.brand,
            model: item.raw.model,
            vehicleType: item.raw.vehicleType ?? "Four-wheeler",
            fuelType: item.raw.fuelType ?? "",
          });
        }}
      />
    </article>
  );
}

function AccountPanel({ items }: { items: Account[] }) {
  const [form, setForm] = useState({ code: "", name: "", accountType: "ASSET" });
  const createMutation = useCreateMaster("/accounting/accounts", ["accounts", "accounting-summary"], () =>
    setForm({ code: "", name: "", accountType: "ASSET" }),
  );
  const seedMutation = useMutation({
    mutationFn: async () => {
      await api.post("/accounting/accounts/seed-defaults");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting-summary"] }),
      ]);
    },
  });

  return (
    <article className="setup-panel master-panel">
      <div className="panel-title-row">
        <h2>Chart of Accounts</h2>
        <Button type="button" variant="outline" disabled={seedMutation.isPending} onClick={() => seedMutation.mutate()}>
          Seed Defaults
        </Button>
      </div>
      <form className="compact-form" onSubmit={(event) => {
        event.preventDefault();
        createMutation.mutate(form);
      }}>
        <input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <select value={form.accountType} onChange={(event) => setForm({ ...form, accountType: event.target.value })}>
          <option>ASSET</option>
          <option>LIABILITY</option>
          <option>EQUITY</option>
          <option>INCOME</option>
          <option>EXPENSE</option>
        </select>
        <Button type="submit" variant="outline" disabled={createMutation.isPending}>Add</Button>
      </form>
      <MasterList items={items.map((item) => ({ id: item.id, label: item.name, meta: `${item.code} / ${item.accountType}` }))} />
    </article>
  );
}

function JournalPanel({ accounts, items }: { accounts: Account[]; items: JournalEntry[] }) {
  const [form, setForm] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    narration: "Manual journal",
    debitAccountId: "",
    creditAccountId: "",
    amount: "0",
  });
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/accounting/journal-entries", {
        entryDate: form.entryDate,
        narration: form.narration,
        lines: [
          { accountId: form.debitAccountId, debitAmount: form.amount },
          { accountId: form.creditAccountId, creditAmount: form.amount },
        ],
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["trial-balance"] }),
        queryClient.invalidateQueries({ queryKey: ["general-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["profit-and-loss"] }),
        queryClient.invalidateQueries({ queryKey: ["balance-sheet"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting-summary"] }),
      ]);
      setForm({ ...form, amount: "0", narration: "Manual journal" });
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-heading"><div><p className="section-kicker dark">Manual accounting</p><h2>Post journal entry</h2></div><span className="context-note">Use only for adjustments not created by sales, purchases or payments. Total debit must equal total credit.</span></div>
      <form className="labeled-form transaction-form" onSubmit={(event) => {
        event.preventDefault();
        if (form.debitAccountId === form.creditAccountId) {
          window.alert("Debit and credit accounts must be different.");
          return;
        }
        if (!window.confirm(`Post journal entry for ${form.amount}?`)) return;
        mutation.mutate();
      }}>
        <label className="form-field"><span>Entry date *</span><input required type="date" value={form.entryDate} onChange={(event) => setForm({ ...form, entryDate: event.target.value })} /></label>
        <label className="form-field"><span>Debit account *</span><select required value={form.debitAccountId} onChange={(event) => setForm({ ...form, debitAccountId: event.target.value })}>
          <option value="">Debit account</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{`${account.code} - ${account.name}`}</option>)}
        </select></label>
        <label className="form-field"><span>Credit account *</span><select required value={form.creditAccountId} onChange={(event) => setForm({ ...form, creditAccountId: event.target.value })}>
          <option value="">Credit account</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{`${account.code} - ${account.name}`}</option>)}
        </select></label>
        <label className="form-field"><span>Amount *</span><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
        <label className="form-field field-span-2"><span>Narration *</span><input required value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Posting..." : "Post journal entry"}</Button></div>
      </form>
      <MasterList
        items={items.map((item) => ({
          id: item.id,
          label: item.entryNumber,
          meta: item.narration ?? `${item.lines.length} lines`,
        }))}
      />
    </article>
  );
}

function ContraVoucherPanel({ accounts }: { accounts: Account[] }) {
  const assetAccounts = accounts.filter((account) => account.accountType === "ASSET");
  const [form, setForm] = useState({
    voucherDate: new Date().toISOString().slice(0, 10),
    fromAccountId: "",
    toAccountId: "",
    amount: "0",
    narration: "Contra voucher",
  });
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/accounting/contra-vouchers", form);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["trial-balance"] }),
        queryClient.invalidateQueries({ queryKey: ["general-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["profit-and-loss"] }),
        queryClient.invalidateQueries({ queryKey: ["balance-sheet"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
      setForm({ ...form, amount: "0", narration: "Contra voucher" });
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-heading"><div><p className="section-kicker dark">Cash and bank transfer</p><h2>Post contra voucher</h2></div><span className="context-note">Use for cash-to-bank, bank-to-cash or transfers between bank accounts.</span></div>
      <form className="labeled-form transaction-form" onSubmit={(event) => {
        event.preventDefault();
        if (form.fromAccountId === form.toAccountId) {
          window.alert("From and to accounts must be different.");
          return;
        }
        if (!window.confirm(`Post contra voucher for ${form.amount}?`)) return;
        mutation.mutate();
      }}>
        <label className="form-field"><span>Voucher date *</span><input required type="date" value={form.voucherDate} onChange={(event) => setForm({ ...form, voucherDate: event.target.value })} /></label>
        <label className="form-field"><span>From account *</span><select required value={form.fromAccountId} onChange={(event) => setForm({ ...form, fromAccountId: event.target.value })}>
          <option value="">From account</option>
          {assetAccounts.map((account) => <option key={account.id} value={account.id}>{`${account.code} - ${account.name}`}</option>)}
        </select></label>
        <label className="form-field"><span>To account *</span><select required value={form.toAccountId} onChange={(event) => setForm({ ...form, toAccountId: event.target.value })}>
          <option value="">To account</option>
          {assetAccounts.map((account) => <option key={account.id} value={account.id}>{`${account.code} - ${account.name}`}</option>)}
        </select></label>
        <label className="form-field"><span>Amount *</span><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
        <label className="form-field field-span-2"><span>Narration *</span><input required value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Posting..." : "Post contra voucher"}</Button></div>
      </form>
    </article>
  );
}

function TrialBalancePanel({ trialBalance }: { trialBalance?: TrialBalance }) {
  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Trial Balance</h2>
      <div className="readiness-grid">
        <ReadinessMetric label="Debit Total" value={trialBalance?.debitTotal} />
        <ReadinessMetric label="Credit Total" value={trialBalance?.creditTotal} />
        <ReadinessMetric label="Debit Balance" value={trialBalance?.debitBalanceTotal} />
        <ReadinessMetric label="Credit Balance" value={trialBalance?.creditBalanceTotal} />
      </div>
      <MasterList
        items={(trialBalance?.rows ?? []).map((row) => ({
          id: row.account?.id ?? `${row.account?.code ?? "account"}-${row.debitTotal}-${row.creditTotal}`,
          label: `${row.account?.code ?? ""} ${row.account?.name ?? "Account"}`,
          meta: `Dr ${row.debitBalance} / Cr ${row.creditBalance}`,
        }))}
      />
    </article>
  );
}

function GeneralLedgerPanel({ items }: { items: GeneralLedgerLine[] }) {
  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>General Ledger</h2>
      <MasterList
        items={items.map((line) => ({
          id: line.id,
          label: `${line.account.code} ${line.account.name}`,
          meta: `${line.entryNumber} / Dr ${line.debitAmount} / Cr ${line.creditAmount}`,
        }))}
      />
    </article>
  );
}

function ProfitAndLossPanel({ statement }: { statement?: ProfitAndLoss }) {
  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Profit & Loss</h2>
      <div className="readiness-grid">
        <ReadinessMetric label="Income" value={statement?.totalIncome} />
        <ReadinessMetric label="Expenses" value={statement?.totalExpenses} />
        <ReadinessMetric label="Net Profit" value={statement?.netProfit} />
      </div>
      <MasterList
        items={[...(statement?.income ?? []), ...(statement?.expenses ?? [])].map((row) => ({
          id: row.account.id,
          label: `${row.account.code} ${row.account.name}`,
          meta: `${row.account.accountType} / ${row.amount}`,
        }))}
      />
    </article>
  );
}

function BalanceSheetPanel({ statement }: { statement?: BalanceSheet }) {
  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Balance Sheet</h2>
      <div className="readiness-grid">
        <ReadinessMetric label="Assets" value={statement?.totalAssets} />
        <ReadinessMetric label="Liabilities" value={statement?.totalLiabilities} />
        <ReadinessMetric label="Equity" value={statement?.totalEquity} />
        <ReadinessMetric label="L + E" value={statement?.totalLiabilitiesAndEquity} />
      </div>
      <MasterList
        items={[...(statement?.assets ?? []), ...(statement?.liabilities ?? []), ...(statement?.equity ?? [])].map((row) => ({
          id: row.account.id,
          label: `${row.account.code} ${row.account.name}`,
          meta: `${row.account.accountType} / ${row.amount}`,
        }))}
      />
    </article>
  );
}

function priceForVariant(variants: ProductVariant[], variantId: string) {
  const variant = variants.find((item) => item.id === variantId);
  return variant ? String(variant.salePrice ?? 0) : "0";
}

function costForVariant(variants: ProductVariant[], variantId: string) {
  const variant = variants.find((item) => item.id === variantId);
  return variant ? String(variant.purchasePrice ?? 0) : "0";
}

function PurchaseInvoicePanel({
  grns,
  invoices,
  suppliers,
  variants,
  warehouses,
}: {
  grns: GoodsReceiptNote[];
  invoices: PurchaseInvoice[];
  suppliers: Supplier[];
  variants: ProductVariant[];
  warehouses: Warehouse[];
}) {
  const [form, setForm] = useState({
    supplierId: "",
    warehouseId: "",
    goodsReceiptNoteId: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    supplierBillNumber: "",
    taxMode: "CGST_SGST",
    productVariantId: "",
    quantity: "1",
    unitCost: "0",
    narration: "Purchase invoice",
  });
  const filteredGrns = grns.filter((grn) => {
    const supplierMatches = !form.supplierId || grn.supplier.id === form.supplierId;
    const warehouseMatches = !form.warehouseId || grn.warehouse.id === form.warehouseId;
    return supplierMatches && warehouseMatches;
  });
  const selectedGrn = grns.find((grn) => grn.id === form.goodsReceiptNoteId);
  const conversionLines = selectedGrn?.lines.map((line) => ({
    productVariantId: line.productVariant.id,
    quantity: line.quantity,
    unitCost: form.unitCost,
  }));
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/purchase/invoices", {
        supplierId: form.supplierId,
        warehouseId: form.warehouseId,
        goodsReceiptNoteId: form.goodsReceiptNoteId,
        invoiceDate: form.invoiceDate,
        supplierBillNumber: form.supplierBillNumber,
        taxMode: form.taxMode,
        narration: form.narration,
        lines: conversionLines?.length
          ? conversionLines
          : [{
              productVariantId: form.productVariantId,
              quantity: form.quantity,
              unitCost: form.unitCost,
            }],
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-balances"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["party-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["party-ledger-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["party-outstanding"] }),
      ]);
      setForm({ ...form, goodsReceiptNoteId: "", productVariantId: "", quantity: "1", unitCost: "0", supplierBillNumber: "" });
    },
  });
  const cancelMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const reason = window.prompt("Cancellation reason");
      if (!reason) {
        return;
      }
      await api.post(`/purchase/invoices/${invoiceId}/cancel`, { reason });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-balances"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-movements"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["party-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["party-ledger-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["gst-summary"] }),
      ]);
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-heading"><div><p className="section-kicker dark">Purchase - Step 3</p><h2>Post supplier invoice</h2></div><span className="context-note">Posting updates stock value, supplier outstanding and accounting. Verify the supplier bill first.</span></div>
      <form className="labeled-form transaction-form" onSubmit={(event) => {
        event.preventDefault();
        if (!window.confirm("Post this supplier invoice? Stock value, supplier outstanding and accounts will be updated.")) return;
        mutation.mutate();
      }}>
        <label className="form-field"><span>Supplier *</span><select required value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value, goodsReceiptNoteId: "" })}>
          <option value="">Supplier</option>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select></label>
        <label className="form-field"><span>Warehouse *</span><select required value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value, goodsReceiptNoteId: "" })}>
          <option value="">Warehouse</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select></label>
        <label className="form-field"><span>Goods receipt (recommended)</span><select
          value={form.goodsReceiptNoteId}
          onChange={(event) => {
            const grn = grns.find((item) => item.id === event.target.value);
            setForm({
              ...form,
              supplierId: grn?.supplier.id ?? form.supplierId,
              warehouseId: grn?.warehouse.id ?? form.warehouseId,
              goodsReceiptNoteId: event.target.value,
              productVariantId: "",
              quantity: "1",
            });
          }}
        >
          <option value="">No GRN</option>
          {filteredGrns.map((grn) => <option key={grn.id} value={grn.id}>{`${grn.grnNumber} / ${grn.supplier.name}`}</option>)}
        </select></label>
        <label className="form-field"><span>Direct product {!selectedGrn ? "*" : ""}</span><select
          required={!selectedGrn}
          disabled={Boolean(selectedGrn)}
          value={form.productVariantId}
          onChange={(event) => setForm({
            ...form,
            productVariantId: event.target.value,
            unitCost: costForVariant(variants, event.target.value),
          })}
        >
          <option value="">Product variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select></label>
        <label className="form-field"><span>Invoice date *</span><input required type="date" value={form.invoiceDate} onChange={(event) => setForm({ ...form, invoiceDate: event.target.value })} /></label>
        <label className="form-field"><span>Supplier bill number *</span><input required value={form.supplierBillNumber} onChange={(event) => setForm({ ...form, supplierBillNumber: event.target.value })} /></label>
        <label className="form-field"><span>Tax mode *</span><select required value={form.taxMode} onChange={(event) => setForm({ ...form, taxMode: event.target.value })}>
          <option value="CGST_SGST">CGST + SGST</option>
          <option value="IGST">IGST</option>
        </select></label>
        <label className="form-field"><span>{selectedGrn ? "GRN lines" : "Quantity *"}</span><input required={!selectedGrn} disabled={Boolean(selectedGrn)} inputMode="decimal" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
        <label className="form-field"><span>Unit cost *</span><input required inputMode="decimal" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} /></label>
        <label className="form-field field-span-2"><span>Narration</span><input value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Posting..." : "Post supplier invoice"}</Button></div>
      </form>
      {conversionLines?.length ? <p className="empty-text">{conversionLines.length} GRN line(s) will be posted with the entered unit cost.</p> : null}
      <InvoiceActionList
        items={invoices.map((invoice) => ({
          id: invoice.id,
          label: invoice.invoiceNumber,
          meta: `${invoice.supplier.name} / ${invoice.goodsReceiptNote?.grnNumber ?? "Direct"} / ${invoice.grandTotal}`,
          status: invoice.status,
        }))}
        onCancel={(invoiceId) => cancelMutation.mutate(invoiceId)}
      />
    </article>
  );
}

function SalesQuotationPanel({
  customers,
  items,
  variants,
}: {
  customers: Customer[];
  items: SalesQuotation[];
  variants: ProductVariant[];
}) {
  const [form, setForm] = useState({
    customerId: "",
    productVariantId: "",
    quotationDate: new Date().toISOString().slice(0, 10),
    validUntil: "",
    quantity: "1",
    unitPrice: "0",
    discountAmount: "0",
    narration: "Sales quotation",
  });
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/sales/quotations", {
        customerId: form.customerId,
        quotationDate: form.quotationDate,
        validUntil: form.validUntil,
        narration: form.narration,
        lines: [{
          productVariantId: form.productVariantId,
          quantity: form.quantity,
          unitPrice: form.unitPrice,
          discountAmount: form.discountAmount,
        }],
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sales-quotations"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
      setForm({ ...form, productVariantId: "", quantity: "1", unitPrice: "0", discountAmount: "0", narration: "Sales quotation" });
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-heading"><div><p className="section-kicker dark">Sales - Step 1</p><h2>Create quotation</h2></div><span className="context-note">A quotation shares price and validity with the customer. It does not affect stock or accounts.</span></div>
      <form className="labeled-form transaction-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <label className="form-field"><span>Customer *</span><select required value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}>
          <option value="">Customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select></label>
        <label className="form-field"><span>Product variant *</span><select required
          value={form.productVariantId}
          onChange={(event) => setForm({
            ...form,
            productVariantId: event.target.value,
            unitPrice: priceForVariant(variants, event.target.value),
          })}
        >
          <option value="">Product variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select></label>
        <label className="form-field"><span>Quotation date *</span><input required type="date" value={form.quotationDate} onChange={(event) => setForm({ ...form, quotationDate: event.target.value })} /></label>
        <label className="form-field"><span>Valid until</span><input type="date" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></label>
        <label className="form-field"><span>Quantity *</span><input required inputMode="decimal" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
        <label className="form-field"><span>Unit price *</span><input required inputMode="decimal" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} /></label>
        <label className="form-field"><span>Discount amount</span><input inputMode="decimal" value={form.discountAmount} onChange={(event) => setForm({ ...form, discountAmount: event.target.value })} /></label>
        <label className="form-field field-span-2"><span>Narration</span><input value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating..." : "Create quotation"}</Button></div>
      </form>
      <MasterList
        items={items.map((quotation) => ({
          id: quotation.id,
          label: quotation.quotationNumber,
          meta: `${quotation.customer.name} / ${quotation.status} / ${quotation.grandTotal}`,
        }))}
      />
    </article>
  );
}

function SalesOrderPanel({
  customers,
  items,
  quotations,
  variants,
}: {
  customers: Customer[];
  items: SalesOrder[];
  quotations: SalesQuotation[];
  variants: ProductVariant[];
}) {
  const [form, setForm] = useState({
    customerId: "",
    quotationId: "",
    productVariantId: "",
    orderDate: new Date().toISOString().slice(0, 10),
    expectedDate: "",
    quantity: "1",
    unitPrice: "0",
    discountAmount: "0",
    narration: "Sales order",
  });
  const customerQuotations = quotations.filter((quotation) => !form.customerId || quotation.customer.id === form.customerId);
  const selectedQuotation = quotations.find((quotation) => quotation.id === form.quotationId);
  const conversionLines = selectedQuotation?.lines.map((line) => ({
    productVariantId: line.productVariant.id,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount ?? 0,
  }));
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/sales/orders", {
        customerId: form.customerId,
        quotationId: form.quotationId,
        orderDate: form.orderDate,
        expectedDate: form.expectedDate,
        narration: form.narration,
        lines: conversionLines?.length
          ? conversionLines
          : [{
              productVariantId: form.productVariantId,
              quantity: form.quantity,
              unitPrice: form.unitPrice,
              discountAmount: form.discountAmount,
            }],
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sales-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
      setForm({ ...form, quotationId: "", productVariantId: "", quantity: "1", unitPrice: "0", discountAmount: "0", narration: "Sales order" });
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-heading"><div><p className="section-kicker dark">Sales - Step 2</p><h2>Create sales order</h2></div><span className="context-note">Convert an accepted quotation or enter a direct order. Stock is not reduced at this step.</span></div>
      <form className="labeled-form transaction-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <label className="form-field"><span>Customer *</span><select required value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value, quotationId: "" })}>
          <option value="">Customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select></label>
        <label className="form-field"><span>Quotation</span><select
          value={form.quotationId}
          onChange={(event) => {
            const quotation = quotations.find((item) => item.id === event.target.value);
            setForm({
              ...form,
              customerId: quotation?.customer.id ?? form.customerId,
              quotationId: event.target.value,
              productVariantId: "",
              quantity: "1",
              unitPrice: "0",
              discountAmount: "0",
            });
          }}
        >
          <option value="">No quotation</option>
          {customerQuotations.map((quotation) => (
            <option key={quotation.id} value={quotation.id}>{`${quotation.quotationNumber} / ${quotation.grandTotal}`}</option>
          ))}
        </select></label>
        <label className="form-field"><span>Direct product {!selectedQuotation ? "*" : ""}</span><select
          required={!selectedQuotation}
          disabled={Boolean(selectedQuotation)}
          value={form.productVariantId}
          onChange={(event) => setForm({
            ...form,
            productVariantId: event.target.value,
            unitPrice: priceForVariant(variants, event.target.value),
          })}
        >
          <option value="">Product variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select></label>
        <label className="form-field"><span>Order date *</span><input required type="date" value={form.orderDate} onChange={(event) => setForm({ ...form, orderDate: event.target.value })} /></label>
        <label className="form-field"><span>Expected delivery</span><input type="date" value={form.expectedDate} onChange={(event) => setForm({ ...form, expectedDate: event.target.value })} /></label>
        <label className="form-field"><span>{selectedQuotation ? "Quotation lines" : "Quantity *"}</span><input required={!selectedQuotation} disabled={Boolean(selectedQuotation)} inputMode="decimal" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
        <label className="form-field"><span>Unit price *</span><input required disabled={Boolean(selectedQuotation)} inputMode="decimal" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} /></label>
        <label className="form-field"><span>Discount amount</span><input disabled={Boolean(selectedQuotation)} inputMode="decimal" value={form.discountAmount} onChange={(event) => setForm({ ...form, discountAmount: event.target.value })} /></label>
        <label className="form-field field-span-2"><span>Narration</span><input value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating..." : "Create sales order"}</Button></div>
      </form>
      {conversionLines?.length ? <p className="empty-text">{conversionLines.length} quotation line(s) will be copied.</p> : null}
      <MasterList
        items={items.map((order) => ({
          id: order.id,
          label: order.orderNumber,
          meta: `${order.customer.name} / ${order.deliveryStatus ?? order.status} / ${order.deliveredQuantity ?? 0} of ${order.orderedQuantity ?? "-"} delivered / ${order.grandTotal}`,
        }))}
      />
    </article>
  );
}

function DeliveryChallanPanel({
  customers,
  items,
  orders,
  variants,
  warehouses,
}: {
  customers: Customer[];
  items: DeliveryChallan[];
  orders: SalesOrder[];
  variants: ProductVariant[];
  warehouses: Warehouse[];
}) {
  const [form, setForm] = useState({
    customerId: "",
    salesOrderId: "",
    warehouseId: "",
    productVariantId: "",
    challanDate: new Date().toISOString().slice(0, 10),
    quantity: "1",
    narration: "Delivery challan",
  });
  const customerOrders = orders.filter((order) => !form.customerId || order.customer.id === form.customerId);
  const selectedOrder = orders.find((order) => order.id === form.salesOrderId);
  const conversionLines = selectedOrder?.lines.map((line) => ({
    productVariantId: line.productVariant.id,
    quantity: line.quantity,
  }));
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/sales/delivery-challans", {
        customerId: form.customerId,
        salesOrderId: form.salesOrderId,
        warehouseId: form.warehouseId,
        challanDate: form.challanDate,
        narration: form.narration,
        lines: conversionLines?.length ? conversionLines : [{ productVariantId: form.productVariantId, quantity: form.quantity }],
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["delivery-challans"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
      setForm({ ...form, salesOrderId: "", productVariantId: "", quantity: "1", narration: "Delivery challan" });
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-heading"><div><p className="section-kicker dark">Sales - Step 3</p><h2>Create delivery challan</h2></div><span className="context-note">Records dispatch against an order. Revenue, tax, accounts and stock are posted only with the invoice.</span></div>
      <form className="labeled-form transaction-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <label className="form-field"><span>Customer *</span><select required value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value, salesOrderId: "" })}>
          <option value="">Customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select></label>
        <label className="form-field"><span>Sales order</span><select
          value={form.salesOrderId}
          onChange={(event) => {
            const order = orders.find((item) => item.id === event.target.value);
            setForm({
              ...form,
              customerId: order?.customer.id ?? form.customerId,
              salesOrderId: event.target.value,
              productVariantId: "",
              quantity: "1",
            });
          }}
        >
          <option value="">No sales order</option>
          {customerOrders.map((order) => <option key={order.id} value={order.id}>{`${order.orderNumber} / ${order.grandTotal}`}</option>)}
        </select></label>
        <label className="form-field"><span>Dispatch warehouse *</span><select required value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}>
          <option value="">Warehouse</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select></label>
        <label className="form-field"><span>Direct product {!selectedOrder ? "*" : ""}</span><select required={!selectedOrder} disabled={Boolean(selectedOrder)} value={form.productVariantId} onChange={(event) => setForm({ ...form, productVariantId: event.target.value })}>
          <option value="">Product variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select></label>
        <label className="form-field"><span>Challan date *</span><input required type="date" value={form.challanDate} onChange={(event) => setForm({ ...form, challanDate: event.target.value })} /></label>
        <label className="form-field"><span>{selectedOrder ? "Order lines" : "Quantity *"}</span><input required={!selectedOrder} disabled={Boolean(selectedOrder)} inputMode="decimal" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
        <label className="form-field field-span-2"><span>Narration</span><input value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating..." : "Create delivery challan"}</Button></div>
      </form>
      {conversionLines?.length ? <p className="empty-text">{conversionLines.length} sales order line(s) will be copied.</p> : null}
      <MasterList
        items={items.map((challan) => ({
          id: challan.id,
          label: challan.challanNumber,
          meta: `${challan.customer.name} / ${challan.warehouse.name} / ${challan.invoiceStatus ?? challan.status} / ${challan.invoicedQuantity ?? 0} of ${challan.deliveredQuantity ?? "-"} invoiced`,
        }))}
      />
    </article>
  );
}

function SalesInvoicePanel({
  company,
  customers,
  deliveryChallans,
  invoices,
  orders,
  variants,
  warehouses,
}: {
  company?: Company;
  customers: Customer[];
  deliveryChallans: DeliveryChallan[];
  invoices: SalesInvoice[];
  orders: SalesOrder[];
  variants: ProductVariant[];
  warehouses: Warehouse[];
}) {
  const [form, setForm] = useState({
    customerId: "",
    warehouseId: "",
    salesOrderId: "",
    deliveryChallanId: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    taxMode: "CGST_SGST",
    productVariantId: "",
    quantity: "1",
    unitPrice: "0",
    discountAmount: "0",
    narration: "Sales invoice",
  });
  const customerOrders = orders.filter((order) => !form.customerId || order.customer.id === form.customerId);
  const customerChallans = deliveryChallans.filter((challan) => {
    const customerMatches = !form.customerId || challan.customer.id === form.customerId;
    const warehouseMatches = !form.warehouseId || challan.warehouse.id === form.warehouseId;
    const orderMatches = !form.salesOrderId || challan.salesOrder?.id === form.salesOrderId;
    return customerMatches && warehouseMatches && orderMatches;
  });
  const selectedOrder = orders.find((order) => order.id === form.salesOrderId);
  const selectedChallan = deliveryChallans.find((challan) => challan.id === form.deliveryChallanId);
  const orderPriceByVariant = new Map(selectedOrder?.lines.map((line) => [line.productVariant.id, line.unitPrice]));
  const orderDiscountByVariant = new Map(selectedOrder?.lines.map((line) => [line.productVariant.id, line.discountAmount ?? 0]));
  const conversionLines = selectedChallan?.lines.map((line) => ({
    productVariantId: line.productVariant.id,
    quantity: line.quantity,
    unitPrice: orderPriceByVariant.get(line.productVariant.id) ?? form.unitPrice,
    discountAmount: orderDiscountByVariant.get(line.productVariant.id) ?? form.discountAmount,
  })) ?? selectedOrder?.lines.map((line) => ({
    productVariantId: line.productVariant.id,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount ?? 0,
  }));
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/sales/invoices", {
        customerId: form.customerId,
        warehouseId: form.warehouseId,
        salesOrderId: form.salesOrderId,
        deliveryChallanId: form.deliveryChallanId,
        invoiceDate: form.invoiceDate,
        taxMode: form.taxMode,
        narration: form.narration,
        lines: conversionLines?.length
          ? conversionLines
          : [{
              productVariantId: form.productVariantId,
              quantity: form.quantity,
              unitPrice: form.unitPrice,
              discountAmount: form.discountAmount,
            }],
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sales-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-balances"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
      ]);
      setForm({ ...form, salesOrderId: "", deliveryChallanId: "", productVariantId: "", quantity: "1", unitPrice: "0", discountAmount: "0" });
    },
  });
  const cancelMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const reason = window.prompt("Cancellation reason");
      if (!reason) {
        return;
      }
      await api.post(`/sales/invoices/${invoiceId}/cancel`, { reason });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sales-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-balances"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-movements"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["party-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["party-ledger-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["gst-summary"] }),
      ]);
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-heading"><div><p className="section-kicker dark">Sales - Step 4</p><h2>Post customer invoice</h2></div><span className="context-note">Posting reduces stock and creates customer outstanding, tax and accounting entries.</span></div>
      <form className="labeled-form transaction-form" onSubmit={(event) => {
        event.preventDefault();
        if (!window.confirm("Post this customer invoice? Stock, customer outstanding, tax and accounts will be updated.")) return;
        mutation.mutate();
      }}>
        <label className="form-field"><span>Customer *</span><select required value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value, salesOrderId: "", deliveryChallanId: "" })}>
          <option value="">Customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select></label>
        <label className="form-field"><span>Dispatch warehouse *</span><select required value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value, deliveryChallanId: "" })}>
          <option value="">Warehouse</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select></label>
        <label className="form-field"><span>Sales order</span><select
          value={form.salesOrderId}
          onChange={(event) => {
            const order = orders.find((item) => item.id === event.target.value);
            setForm({
              ...form,
              customerId: order?.customer.id ?? form.customerId,
              salesOrderId: event.target.value,
              deliveryChallanId: "",
              productVariantId: "",
              quantity: "1",
              unitPrice: "0",
              discountAmount: "0",
            });
          }}
        >
          <option value="">No sales order</option>
          {customerOrders.map((order) => <option key={order.id} value={order.id}>{`${order.orderNumber} / ${order.grandTotal}`}</option>)}
        </select></label>
        <label className="form-field"><span>Delivery challan</span><select
          value={form.deliveryChallanId}
          onChange={(event) => {
            const challan = deliveryChallans.find((item) => item.id === event.target.value);
            setForm({
              ...form,
              customerId: challan?.customer.id ?? form.customerId,
              warehouseId: challan?.warehouse.id ?? form.warehouseId,
              salesOrderId: challan?.salesOrder?.id ?? form.salesOrderId,
              deliveryChallanId: event.target.value,
              productVariantId: "",
              quantity: "1",
              discountAmount: "0",
            });
          }}
        >
          <option value="">No delivery challan</option>
          {customerChallans.map((challan) => <option key={challan.id} value={challan.id}>{`${challan.challanNumber} / ${challan.customer.name}`}</option>)}
        </select></label>
        <label className="form-field"><span>Direct product {!conversionLines?.length ? "*" : ""}</span><select
          required={!conversionLines?.length}
          disabled={Boolean(conversionLines?.length)}
          value={form.productVariantId}
          onChange={(event) => setForm({
            ...form,
            productVariantId: event.target.value,
            unitPrice: priceForVariant(variants, event.target.value),
          })}
        >
          <option value="">Product variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select></label>
        <label className="form-field"><span>Invoice date *</span><input required type="date" value={form.invoiceDate} onChange={(event) => setForm({ ...form, invoiceDate: event.target.value })} /></label>
        <label className="form-field"><span>Tax mode *</span><select required value={form.taxMode} onChange={(event) => setForm({ ...form, taxMode: event.target.value })}>
          <option value="CGST_SGST">CGST + SGST</option>
          <option value="IGST">IGST</option>
        </select></label>
        <label className="form-field"><span>{conversionLines?.length ? "Source lines" : "Quantity *"}</span><input required={!conversionLines?.length} disabled={Boolean(conversionLines?.length)} inputMode="decimal" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
        <label className="form-field"><span>Unit price *</span><input required disabled={Boolean(conversionLines?.length)} inputMode="decimal" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} /></label>
        <label className="form-field"><span>Discount amount</span><input disabled={Boolean(conversionLines?.length)} inputMode="decimal" value={form.discountAmount} onChange={(event) => setForm({ ...form, discountAmount: event.target.value })} /></label>
        <label className="form-field field-span-2"><span>Narration</span><input value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Posting..." : "Post customer invoice"}</Button></div>
      </form>
      {conversionLines?.length ? <p className="empty-text">{conversionLines.length} source document line(s) will be posted.</p> : null}
      <InvoiceActionList
        items={invoices.map((invoice) => ({
          id: invoice.id,
          label: invoice.invoiceNumber,
          meta: `${invoice.customer.name} / ${invoice.deliveryChallan?.challanNumber ?? invoice.salesOrder?.orderNumber ?? "Direct"} / ${invoice.grandTotal}`,
          status: invoice.status,
        }))}
        onCancel={(invoiceId) => cancelMutation.mutate(invoiceId)}
        onPrint={(invoiceId) => {
          const invoice = invoices.find((item) => item.id === invoiceId);
          if (!invoice || !company) {
            window.alert("Invoice profile is still loading. Please try again.");
            return;
          }
          printSalesInvoice(company, invoice);
        }}
      />
    </article>
  );
}

function InvoiceActionList({
  items,
  onCancel,
  onPrint,
}: {
  items: Array<{ id: string; label: string; meta: string; status: string }>;
  onCancel: (id: string) => void;
  onPrint?: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="empty-text">No records yet.</p>;
  }

  return (
    <ul className="compact-list action-list">
      {items.slice(0, 6).map((item) => (
        <li key={item.id}>
          <span>{item.label}</span>
          <strong>{`${item.meta} / ${item.status}`}</strong>
          <div className="action-buttons">
            {onPrint ? <Button type="button" variant="outline" onClick={() => onPrint(item.id)}>Print</Button> : null}
            {item.status === "POSTED" ? (
              <Button type="button" variant="outline" onClick={() => onCancel(item.id)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function escapePrintHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function invoiceAmount(value: string | number | undefined) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

function printSalesInvoice(company: Company, invoice: SalesInvoice) {
  const printWindow = window.open("", "_blank", "width=1000,height=760");
  if (!printWindow) {
    window.alert("The print window was blocked. Allow pop-ups for RAMS and try again.");
    return;
  }

  const companyAddress = [company.addressLine1, company.addressLine2, company.city, company.state, company.pincode]
    .filter(Boolean).map(escapePrintHtml).join(", ");
  const customerAddress = [invoice.customer.addressLine1, invoice.customer.addressLine2, invoice.customer.city, invoice.customer.state, invoice.customer.pincode]
    .filter(Boolean).map(escapePrintHtml).join(", ");
  const rows = invoice.lines.map((line, index) => {
    const gstRate = invoice.taxMode === "IGST" ? Number(line.igstRate) : Number(line.cgstRate) + Number(line.sgstRate);
    const taxAmount = Number(line.cgstAmount) + Number(line.sgstAmount) + Number(line.igstAmount);
    return `<tr>
      <td>${index + 1}</td>
      <td><strong>${escapePrintHtml(line.productVariant.name)}</strong><small>${escapePrintHtml(line.productVariant.code)}</small></td>
      <td>${escapePrintHtml(line.hsnCode || "-")}</td>
      <td class="num">${escapePrintHtml(line.quantity)}</td>
      <td class="num">${invoiceAmount(line.unitPrice)}</td>
      <td class="num">${invoiceAmount(line.discountAmount)}</td>
      <td class="num">${invoiceAmount(line.taxableAmount)}</td>
      <td class="num">${invoiceAmount(gstRate)}%</td>
      <td class="num">${invoiceAmount(taxAmount)}</td>
      <td class="num">${invoiceAmount(line.lineTotal)}</td>
    </tr>`;
  }).join("");

  printWindow.document.write(`<!doctype html>
  <html lang="en"><head><meta charset="utf-8"><title>${escapePrintHtml(invoice.invoiceNumber)} - Tax Invoice</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #17202a; font: 12px Arial, sans-serif; }
    .invoice { border: 1px solid #344054; }
    header { display: flex; justify-content: space-between; gap: 24px; padding: 18px; border-bottom: 1px solid #344054; }
    h1 { margin: 0 0 5px; font-size: 23px; } h2 { margin: 0; font-size: 19px; letter-spacing: 1px; }
    p { margin: 3px 0; line-height: 1.35; } .muted { color: #667085; } .status { font-weight: 700; color: ${invoice.status === "CANCELLED" ? "#b42318" : "#067647"}; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #344054; }
    .party { min-height: 112px; padding: 12px 18px; } .party + .party { border-left: 1px solid #344054; }
    .label { margin-bottom: 6px; color: #475467; font-size: 10px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; } th, td { padding: 7px 6px; border-right: 1px solid #d0d5dd; border-bottom: 1px solid #d0d5dd; vertical-align: top; }
    th:last-child, td:last-child { border-right: 0; } th { background: #f2f4f7; font-size: 10px; text-transform: uppercase; } td small { display: block; margin-top: 2px; color: #667085; }
    .num { text-align: right; white-space: nowrap; }
    .summary { display: grid; grid-template-columns: 1fr 290px; } .notes { padding: 14px 18px; } .totals { border-left: 1px solid #344054; }
    .total-row { display: flex; justify-content: space-between; padding: 7px 12px; border-bottom: 1px solid #d0d5dd; }
    .grand { background: #ecfdf3; font-size: 15px; font-weight: 700; }
    footer { display: flex; justify-content: space-between; padding: 20px 18px 12px; border-top: 1px solid #344054; }
    .signature { min-width: 190px; padding-top: 34px; border-bottom: 1px solid #344054; text-align: center; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style></head><body>
    <main class="invoice">
      <header><div><h1>${escapePrintHtml(company.legalName || company.name)}</h1><p>${companyAddress || "Business address not configured"}</p><p>Phone: ${escapePrintHtml(company.phone || "-")} &nbsp; Email: ${escapePrintHtml(company.email || "-")}</p><p><strong>GSTIN: ${escapePrintHtml(company.gstin || "Not configured")}</strong></p></div><div class="num"><h2>TAX INVOICE</h2><p><strong>${escapePrintHtml(invoice.invoiceNumber)}</strong></p><p>Date: ${escapePrintHtml(new Date(invoice.invoiceDate).toLocaleDateString("en-IN"))}</p><p class="status">${escapePrintHtml(invoice.status)}</p></div></header>
      <section class="parties"><div class="party"><div class="label">Bill to</div><p><strong>${escapePrintHtml(invoice.customer.name)}</strong></p><p>${customerAddress || "Address not configured"}</p><p>Phone: ${escapePrintHtml(invoice.customer.phone || "-")}</p><p>GSTIN: ${escapePrintHtml(invoice.customer.gstin || "Unregistered")}</p></div><div class="party"><div class="label">Supply details</div><p>Place of supply: <strong>${escapePrintHtml(invoice.customer.placeOfSupply || invoice.customer.state || "Not configured")}</strong></p><p>Tax mode: ${escapePrintHtml(invoice.taxMode === "IGST" ? "IGST" : "CGST + SGST")}</p><p>Warehouse: ${escapePrintHtml(invoice.warehouse.name)}</p><p>Source: ${escapePrintHtml(invoice.deliveryChallan?.challanNumber || invoice.salesOrder?.orderNumber || "Direct invoice")}</p></div></section>
      <table><thead><tr><th>#</th><th>Item</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Discount</th><th>Taxable</th><th>GST</th><th>Tax</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      <section class="summary"><div class="notes"><div class="label">Narration</div><p>${escapePrintHtml(invoice.narration || "Sales invoice")}</p><p class="muted">Amount values are in ${escapePrintHtml(company.baseCurrency || "INR")}.</p></div><div class="totals"><div class="total-row"><span>Taxable amount</span><strong>${invoiceAmount(invoice.taxableAmount)}</strong></div><div class="total-row"><span>CGST</span><strong>${invoiceAmount(invoice.cgstAmount)}</strong></div><div class="total-row"><span>SGST</span><strong>${invoiceAmount(invoice.sgstAmount)}</strong></div><div class="total-row"><span>IGST</span><strong>${invoiceAmount(invoice.igstAmount)}</strong></div><div class="total-row"><span>Total tax</span><strong>${invoiceAmount(invoice.totalTaxAmount)}</strong></div><div class="total-row grand"><span>Grand total</span><span>${invoiceAmount(invoice.grandTotal)}</span></div></div></section>
      <footer><p class="muted">Computer-generated invoice from RAMS ERP.</p><div><p>For ${escapePrintHtml(company.name)}</p><div class="signature">Authorised signatory</div></div></footer>
    </main>
  </body></html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

function PurchaseReturnPanel({ invoices, items }: { invoices: PurchaseInvoice[]; items: PurchaseReturn[] }) {
  const [form, setForm] = useState({
    purchaseInvoiceId: "",
    purchaseInvoiceLineId: "",
    quantity: "1",
    returnDate: new Date().toISOString().slice(0, 10),
    reason: "Purchase return",
  });
  const selectedInvoice = invoices.find((invoice) => invoice.id === form.purchaseInvoiceId);
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/purchase/returns", {
        purchaseInvoiceId: form.purchaseInvoiceId,
        returnDate: form.returnDate,
        reason: form.reason,
        lines: [{ purchaseInvoiceLineId: form.purchaseInvoiceLineId, quantity: form.quantity }],
      });
    },
    onSuccess: async () => {
      await invalidatePostingQueries(["purchase-returns"]);
      setForm({ ...form, purchaseInvoiceLineId: "", quantity: "1", reason: "Purchase return" });
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Post Purchase Return</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <select
          value={form.purchaseInvoiceId}
          onChange={(event) => setForm({ ...form, purchaseInvoiceId: event.target.value, purchaseInvoiceLineId: "" })}
        >
          <option value="">Purchase invoice</option>
          {invoices.filter((invoice) => invoice.status === "POSTED").map((invoice) => (
            <option key={invoice.id} value={invoice.id}>{`${invoice.invoiceNumber} - ${invoice.supplier.name}`}</option>
          ))}
        </select>
        <select value={form.purchaseInvoiceLineId} onChange={(event) => setForm({ ...form, purchaseInvoiceLineId: event.target.value })}>
          <option value="">Invoice line</option>
          {(selectedInvoice?.lines ?? []).map((line) => (
            <option key={line.id} value={line.id}>{`${line.productVariant.name} / Qty ${line.quantity}`}</option>
          ))}
        </select>
        <input type="date" value={form.returnDate} onChange={(event) => setForm({ ...form, returnDate: event.target.value })} />
        <input placeholder="Quantity" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        <input placeholder="Reason" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Post</Button>
      </form>
      <MasterList
        items={items.map((item) => ({
          id: item.id,
          label: item.returnNumber,
          meta: `${item.supplier.name} / ${item.grandTotal}`,
        }))}
      />
    </article>
  );
}

function SalesReturnPanel({ invoices, items }: { invoices: SalesInvoice[]; items: SalesReturn[] }) {
  const [form, setForm] = useState({
    salesInvoiceId: "",
    salesInvoiceLineId: "",
    quantity: "1",
    returnDate: new Date().toISOString().slice(0, 10),
    reason: "Sales return",
  });
  const selectedInvoice = invoices.find((invoice) => invoice.id === form.salesInvoiceId);
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/sales/returns", {
        salesInvoiceId: form.salesInvoiceId,
        returnDate: form.returnDate,
        reason: form.reason,
        lines: [{ salesInvoiceLineId: form.salesInvoiceLineId, quantity: form.quantity }],
      });
    },
    onSuccess: async () => {
      await invalidatePostingQueries(["sales-returns"]);
      setForm({ ...form, salesInvoiceLineId: "", quantity: "1", reason: "Sales return" });
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Post Sales Return</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <select
          value={form.salesInvoiceId}
          onChange={(event) => setForm({ ...form, salesInvoiceId: event.target.value, salesInvoiceLineId: "" })}
        >
          <option value="">Sales invoice</option>
          {invoices.filter((invoice) => invoice.status === "POSTED").map((invoice) => (
            <option key={invoice.id} value={invoice.id}>{`${invoice.invoiceNumber} - ${invoice.customer.name}`}</option>
          ))}
        </select>
        <select value={form.salesInvoiceLineId} onChange={(event) => setForm({ ...form, salesInvoiceLineId: event.target.value })}>
          <option value="">Invoice line</option>
          {(selectedInvoice?.lines ?? []).map((line) => (
            <option key={line.id} value={line.id}>{`${line.productVariant.name} / Qty ${line.quantity}`}</option>
          ))}
        </select>
        <input type="date" value={form.returnDate} onChange={(event) => setForm({ ...form, returnDate: event.target.value })} />
        <input placeholder="Quantity" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        <input placeholder="Reason" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Post</Button>
      </form>
      <MasterList
        items={items.map((item) => ({
          id: item.id,
          label: item.returnNumber,
          meta: `${item.customer.name} / ${item.grandTotal}`,
        }))}
      />
    </article>
  );
}

function PartyLedgerPanel({ items }: { items: PartyLedgerEntry[] }) {
  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Party Ledger</h2>
      <MasterList
        items={items.map((entry) => ({
          id: entry.id,
          label: `${entry.documentNumber} / ${entry.customer?.name ?? entry.supplier?.name ?? entry.partyType}`,
          meta: `Dr ${entry.debitAmount} / Cr ${entry.creditAmount}`,
        }))}
      />
    </article>
  );
}

function OutstandingPanel({ outstanding }: { outstanding?: PartyOutstanding }) {
  const customerItems = outstanding?.customers ?? [];
  const supplierItems = outstanding?.suppliers ?? [];

  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Outstanding Balances</h2>
      <div className="split-list-grid">
        <div>
          <h3>Customer Receivables</h3>
          <MasterList
            items={customerItems.map((entry) => ({
              id: entry.party?.id ?? `${entry.party?.name}-${entry.balance}`,
              label: entry.party?.name ?? "Customer",
              meta: `${entry.party?.code ?? ""} / Balance ${entry.balance} / Limit ${entry.creditLimit ?? entry.party?.creditLimit ?? 0} / Available ${entry.creditAvailable ?? 0} / ${entry.creditStatus ?? "OK"}`,
            }))}
          />
        </div>
        <div>
          <h3>Supplier Payables</h3>
          <MasterList
            items={supplierItems.map((entry) => ({
              id: entry.party?.id ?? `${entry.party?.name}-${entry.balance}`,
              label: entry.party?.name ?? "Supplier",
              meta: `${entry.party?.code ?? ""} / ${entry.balance}`,
            }))}
          />
        </div>
      </div>
    </article>
  );
}

function PaymentPanel({
  customers,
  items,
  paymentModes,
  suppliers,
}: {
  customers: Customer[];
  items: Payment[];
  paymentModes: PaymentMode[];
  suppliers: Supplier[];
}) {
  const [form, setForm] = useState({
    partyType: "CUSTOMER",
    partyId: "",
    paymentModeId: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: "0",
    referenceNo: "",
    narration: "Payment",
    allocationDocumentNumber: "",
    allocationAmount: "",
  });
  const parties = form.partyType === "CUSTOMER" ? customers : suppliers;
  const openDocuments = useQuery({
    queryKey: ["open-settlement-documents", form.partyType, form.partyId],
    enabled: Boolean(form.partyId),
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<OpenSettlementDocument[]>>(
        `/payments/open-documents?partyType=${form.partyType}&partyId=${form.partyId}`,
      );
      return response.data.data;
    },
  });
  const selectedOpenDocument = (openDocuments.data ?? []).find((document) => document.documentNumber === form.allocationDocumentNumber);
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/payments", {
        ...form,
        allocations: selectedOpenDocument && Number(form.allocationAmount || 0) > 0
          ? [{
              documentType: selectedOpenDocument.documentType,
              documentId: selectedOpenDocument.documentId,
              documentNumber: selectedOpenDocument.documentNumber,
              amount: form.allocationAmount,
            }]
          : [],
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["open-settlement-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["payment-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["party-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["party-ledger-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
      ]);
      setForm({ ...form, partyId: "", amount: "0", referenceNo: "", allocationDocumentNumber: "", allocationAmount: "" });
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-heading"><div><p className="section-kicker dark">Settlement</p><h2>Record receipt or payment</h2></div><span className="context-note">Select an open invoice to settle it. Leave allocation blank only for an advance or unallocated payment.</span></div>
      <form className="labeled-form transaction-form" onSubmit={(event) => {
        event.preventDefault();
        const direction = form.partyType === "CUSTOMER" ? "customer receipt" : "supplier payment";
        if (!window.confirm(`Post this ${direction} for ${form.amount}?`)) return;
        mutation.mutate();
      }}>
        <label className="form-field"><span>Transaction type *</span><select required value={form.partyType} onChange={(event) => setForm({ ...form, partyType: event.target.value, partyId: "", allocationDocumentNumber: "", allocationAmount: "" })}>
          <option value="CUSTOMER">Customer receipt</option>
          <option value="SUPPLIER">Supplier payment</option>
        </select></label>
        <label className="form-field"><span>{form.partyType === "CUSTOMER" ? "Customer *" : "Supplier *"}</span><select required value={form.partyId} onChange={(event) => setForm({ ...form, partyId: event.target.value, allocationDocumentNumber: "", allocationAmount: "" })}>
          <option value="">{form.partyType === "CUSTOMER" ? "Customer" : "Supplier"}</option>
          {parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}
        </select></label>
        <label className="form-field"><span>Payment mode *</span><select required value={form.paymentModeId} onChange={(event) => setForm({ ...form, paymentModeId: event.target.value })}>
          <option value="">Payment mode</option>
          {paymentModes.map((mode) => <option key={mode.id} value={mode.id}>{mode.name}</option>)}
        </select></label>
        <label className="form-field"><span>Payment date *</span><input required type="date" value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} /></label>
        <label className="form-field"><span>Total amount *</span><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
        <label className="form-field"><span>Reference number</span><input value={form.referenceNo} onChange={(event) => setForm({ ...form, referenceNo: event.target.value })} /></label>
        <label className="form-field field-span-2"><span>Narration</span><input value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} /></label>
        <label className="form-field field-span-2"><span>Allocate to invoice</span><select
          value={form.allocationDocumentNumber}
          onChange={(event) => {
            const document = (openDocuments.data ?? []).find((item) => item.documentNumber === event.target.value);
            setForm({
              ...form,
              allocationDocumentNumber: event.target.value,
              allocationAmount: document ? String(document.openAmount) : "",
            });
          }}
        >
          <option value="">Allocate to document</option>
          {(openDocuments.data ?? []).map((document) => (
            <option key={document.id} value={document.documentNumber}>
              {`${document.documentNumber} / Open ${document.openAmount}`}
            </option>
          ))}
        </select></label>
        <label className="form-field"><span>Allocated amount</span><input type="number" min="0" max={selectedOpenDocument?.openAmount} step="0.01" disabled={!selectedOpenDocument} value={form.allocationAmount} onChange={(event) => setForm({ ...form, allocationAmount: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Posting..." : form.partyType === "CUSTOMER" ? "Post customer receipt" : "Post supplier payment"}</Button></div>
      </form>
      {form.partyId && openDocuments.isLoading ? <p className="empty-text">Loading open invoices...</p> : null}
      {form.partyId && !openDocuments.isLoading && !(openDocuments.data ?? []).length ? <p className="empty-text">No open invoices for this party. The payment can be recorded as an advance.</p> : null}
      <MasterList
        items={(openDocuments.data ?? []).map((document) => ({
          id: document.id,
          label: `${document.documentNumber} / ${document.documentType}`,
          meta: `${document.entryDate.slice(0, 10)} / Amount ${document.documentAmount} / Allocated ${document.allocatedAmount} / Open ${document.openAmount}`,
        }))}
      />
      <MasterList
        items={items.map((payment) => ({
          id: payment.id,
          label: payment.paymentNumber,
          meta: `${payment.customer?.name ?? payment.supplier?.name ?? payment.partyType} / ${payment.amount} / Settled ${payment.allocations?.reduce((total, allocation) => total + Number(allocation.allocatedAmount), 0) ?? 0}`,
        }))}
      />
    </article>
  );
}

function FinancialNotePanel({
  customers,
  items,
  suppliers,
}: {
  customers: Customer[];
  items: FinancialNote[];
  suppliers: Supplier[];
}) {
  const [form, setForm] = useState({
    partyType: "CUSTOMER",
    noteType: "CREDIT_NOTE",
    partyId: "",
    noteDate: new Date().toISOString().slice(0, 10),
    amount: "0",
    reason: "Financial adjustment",
  });
  const parties = form.partyType === "CUSTOMER" ? customers : suppliers;
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/notes", form);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["party-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["party-ledger-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["party-outstanding"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
      ]);
      setForm({ ...form, partyId: "", amount: "0", reason: "Financial adjustment" });
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Post Credit / Debit Note</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <select value={form.partyType} onChange={(event) => setForm({ ...form, partyType: event.target.value, partyId: "" })}>
          <option value="CUSTOMER">Customer</option>
          <option value="SUPPLIER">Supplier</option>
        </select>
        <select value={form.noteType} onChange={(event) => setForm({ ...form, noteType: event.target.value })}>
          <option value="CREDIT_NOTE">Credit note</option>
          <option value="DEBIT_NOTE">Debit note</option>
        </select>
        <select value={form.partyId} onChange={(event) => setForm({ ...form, partyId: event.target.value })}>
          <option value="">{form.partyType === "CUSTOMER" ? "Customer" : "Supplier"}</option>
          {parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}
        </select>
        <input type="date" value={form.noteDate} onChange={(event) => setForm({ ...form, noteDate: event.target.value })} />
        <input placeholder="Amount" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
        <input placeholder="Reason" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Post</Button>
      </form>
      <MasterList
        items={items.map((note) => ({
          id: note.id,
          label: note.noteNumber,
          meta: `${note.noteType} / ${note.customer?.name ?? note.supplier?.name ?? note.partyType} / ${note.amount}`,
        }))}
      />
    </article>
  );
}

function JobCardPanel({
  company,
  stage,
  customers,
  employees,
  items,
  taxRates,
  variants,
  vehicles,
  warehouses,
}: {
  company?: Company;
  stage: "intake" | "inspection" | "parts" | "billing";
  customers: Customer[];
  employees: Employee[];
  items: JobCard[];
  taxRates: TaxRate[];
  variants: ProductVariant[];
  vehicles: Vehicle[];
  warehouses: Warehouse[];
}) {
  const [form, setForm] = useState({
    activeJobCardId: "",
    customerId: "",
    vehicleId: "",
    advisorEmployeeId: "",
    technicianEmployeeId: "",
    jobDate: new Date().toISOString().slice(0, 10),
    expectedDeliveryAt: "",
    odometerReading: "0",
    fuelLevel: "",
    complaint: "",
    diagnosis: "",
    workNotes: "",
    inspectionNotes: "",
    complaintVerified: false,
    roadTestCompleted: false,
    qualityCheckCompleted: false,
    deliveryNotes: "",
    technicianStatus: "ASSIGNED",
    technicianNotes: "",
    partVariantId: "",
    partQuantity: "1",
    partRate: "0",
    laborDescription: "",
    laborAmount: "0",
    issueWarehouseId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    billingDate: new Date().toISOString().slice(0, 10),
    billingAmount: "0",
    billingTaxMode: "CGST_SGST",
    serviceTaxRateId: "",
  });
  const customerVehicles = vehicles.filter((vehicle) => !form.customerId || vehicle.customer?.id === form.customerId);
  const eligibleJobCards = items.filter((item) => {
    if (stage === "inspection") return !["CANCELLED", "DELIVERED"].includes(item.status);
    if (stage === "parts") return !item.partsIssuedAt && !["CANCELLED", "DELIVERED"].includes(item.status);
    if (stage === "billing") return !item.billedAt && item.status !== "CANCELLED";
    return true;
  });
  const activeJobCard = eligibleJobCards.find((item) => item.id === form.activeJobCardId);
  const selectJobCard = (jobCardId: string) => {
    const jobCard = items.find((item) => item.id === jobCardId);
    setForm((current) => ({
      ...current,
      activeJobCardId: jobCardId,
      diagnosis: jobCard?.diagnosis ?? "",
      workNotes: jobCard?.workNotes ?? "",
      inspectionNotes: jobCard?.inspectionNotes ?? "",
      technicianStatus: jobCard?.technicianStatus ?? "ASSIGNED",
      technicianNotes: jobCard?.technicianNotes ?? "",
      billingAmount: String(jobCard?.estimatedTotal ?? 0),
      deliveryNotes: jobCard?.deliveryNotes ?? "",
    }));
  };
  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/workshop/job-cards", {
        customerId: form.customerId,
        vehicleId: form.vehicleId,
        advisorEmployeeId: form.advisorEmployeeId,
        technicianEmployeeId: form.technicianEmployeeId,
        jobDate: form.jobDate,
        expectedDeliveryAt: form.expectedDeliveryAt,
        odometerReading: form.odometerReading,
        fuelLevel: form.fuelLevel,
        complaint: form.complaint,
        diagnosis: form.diagnosis,
        workNotes: form.workNotes,
        parts: form.partVariantId
          ? [{ productVariantId: form.partVariantId, quantity: form.partQuantity, estimatedRate: form.partRate }]
          : [],
        laborLines: form.laborDescription
          ? [{ description: form.laborDescription, estimatedAmount: form.laborAmount }]
          : [],
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["job-cards"] }),
        queryClient.invalidateQueries({ queryKey: ["workshop-summary"] }),
      ]);
      setForm({
        ...form,
        complaint: "",
        diagnosis: "",
        workNotes: "",
        inspectionNotes: "",
        deliveryNotes: "",
        partVariantId: "",
        partQuantity: "1",
        partRate: "0",
        laborDescription: "",
        laborAmount: "0",
      });
    },
  });
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/workshop/job-cards/${id}/status`, { status, deliveryNotes: form.deliveryNotes });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["job-cards"] }),
        queryClient.invalidateQueries({ queryKey: ["workshop-summary"] }),
      ]);
    },
  });
  const inspectionMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/workshop/job-cards/${id}/inspection`, {
        diagnosis: form.diagnosis,
        workNotes: form.workNotes,
        inspectionNotes: form.inspectionNotes,
        inspectionChecklist: [
          { label: "Complaint verified", checked: form.complaintVerified },
          { label: "Road test completed", checked: form.roadTestCompleted },
          { label: "Final quality check completed", checked: form.qualityCheckCompleted },
        ],
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["job-cards"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
      setForm((current) => ({ ...current, activeJobCardId: "" }));
    },
  });
  const technicianMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/workshop/job-cards/${id}/technician`, {
        technicianStatus: form.technicianStatus,
        technicianNotes: form.technicianNotes,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["job-cards"] }),
        queryClient.invalidateQueries({ queryKey: ["service-history"] }),
        queryClient.invalidateQueries({ queryKey: ["workshop-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
      setForm((current) => ({ ...current, activeJobCardId: "" }));
    },
  });
  const issueMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/workshop/job-cards/${id}/issue-parts`, { warehouseId: form.issueWarehouseId, issueDate: form.issueDate });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["job-cards"] }),
        queryClient.invalidateQueries({ queryKey: ["service-history"] }),
        queryClient.invalidateQueries({ queryKey: ["workshop-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-balances"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-movements"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["trial-balance"] }),
        queryClient.invalidateQueries({ queryKey: ["general-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["profit-and-loss"] }),
        queryClient.invalidateQueries({ queryKey: ["balance-sheet"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
    },
  });
  const billingMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/workshop/job-cards/${id}/bill`, {
        billingDate: form.billingDate,
        billingAmount: form.billingAmount,
        taxMode: form.billingTaxMode,
        serviceTaxRateId: form.serviceTaxRateId,
        deliveryNotes: form.deliveryNotes,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["job-cards"] }),
        queryClient.invalidateQueries({ queryKey: ["service-history"] }),
        queryClient.invalidateQueries({ queryKey: ["workshop-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["party-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["party-ledger-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["party-outstanding"] }),
        queryClient.invalidateQueries({ queryKey: ["trial-balance"] }),
        queryClient.invalidateQueries({ queryKey: ["general-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["profit-and-loss"] }),
        queryClient.invalidateQueries({ queryKey: ["balance-sheet"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-heading"><div><p className="section-kicker dark">{stage === "intake" ? "Workshop - Step 1" : stage === "inspection" ? "Workshop - Step 2" : stage === "parts" ? "Workshop - Step 3" : "Workshop - Step 4"}</p><h2>{stage === "intake" ? "Create job card" : stage === "inspection" ? "Inspect and update work" : stage === "parts" ? "Issue estimated parts" : "Bill and deliver vehicle"}</h2></div><span className="context-note">{stage === "intake" ? "Record the vehicle complaint and estimate. Stock and accounts are not changed." : stage === "inspection" ? "Select one open job card, record actual findings and complete the checklist honestly." : stage === "parts" ? "This reduces warehouse stock and posts inventory cost. Verify every estimated part first." : "This creates customer outstanding, GST and accounting entries, then closes the job card."}</span></div>

      {stage === "intake" ? <form className="labeled-form transaction-form" onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>
        <label className="form-field"><span>Customer *</span><select required value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value, vehicleId: "" })}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        <label className="form-field"><span>Vehicle *</span><select required value={form.vehicleId} onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}><option value="">Select vehicle</option>{customerVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{`${vehicle.registrationNumber} - ${vehicle.brand} ${vehicle.model}`}</option>)}</select></label>
        <label className="form-field"><span>Service advisor</span><select value={form.advisorEmployeeId} onChange={(event) => setForm({ ...form, advisorEmployeeId: event.target.value })}><option value="">Not assigned</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
        <label className="form-field"><span>Technician</span><select value={form.technicianEmployeeId} onChange={(event) => setForm({ ...form, technicianEmployeeId: event.target.value })}><option value="">Assign later</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
        <label className="form-field"><span>Job date *</span><input required type="date" value={form.jobDate} onChange={(event) => setForm({ ...form, jobDate: event.target.value })} /></label>
        <label className="form-field"><span>Expected delivery</span><input type="datetime-local" value={form.expectedDeliveryAt} onChange={(event) => setForm({ ...form, expectedDeliveryAt: event.target.value })} /></label>
        <label className="form-field"><span>Odometer *</span><input required type="number" min="0" step="1" value={form.odometerReading} onChange={(event) => setForm({ ...form, odometerReading: event.target.value })} /></label>
        <label className="form-field"><span>Fuel level</span><input placeholder="Example: Half tank" value={form.fuelLevel} onChange={(event) => setForm({ ...form, fuelLevel: event.target.value })} /></label>
        <label className="form-field field-span-full"><span>Customer complaint *</span><textarea required rows={3} value={form.complaint} onChange={(event) => setForm({ ...form, complaint: event.target.value })} /></label>
        <label className="form-field"><span>Estimated part</span><select value={form.partVariantId} onChange={(event) => setForm({ ...form, partVariantId: event.target.value, partRate: priceForVariant(variants, event.target.value) })}><option value="">No part estimate</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}</select></label>
        <label className="form-field"><span>Part quantity</span><input type="number" min="0.001" step="0.001" disabled={!form.partVariantId} value={form.partQuantity} onChange={(event) => setForm({ ...form, partQuantity: event.target.value })} /></label>
        <label className="form-field"><span>Estimated part rate</span><input type="number" min="0" step="0.01" disabled={!form.partVariantId} value={form.partRate} onChange={(event) => setForm({ ...form, partRate: event.target.value })} /></label>
        <label className="form-field"><span>Labor description</span><input placeholder="Example: General service" value={form.laborDescription} onChange={(event) => setForm({ ...form, laborDescription: event.target.value })} /></label>
        <label className="form-field"><span>Estimated labor amount</span><input type="number" min="0" step="0.01" disabled={!form.laborDescription} value={form.laborAmount} onChange={(event) => setForm({ ...form, laborAmount: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating..." : "Create job card"}</Button></div>
      </form> : null}

      {stage !== "intake" ? <form className="labeled-form transaction-form" onSubmit={(event) => {
        event.preventDefault();
        if (!activeJobCard) return;
        if (stage === "inspection") inspectionMutation.mutate(activeJobCard.id);
        if (stage === "parts" && window.confirm(`Issue parts for ${activeJobCard.jobCardNumber}? Warehouse stock and inventory cost will be posted.`)) issueMutation.mutate(activeJobCard.id);
        if (stage === "billing" && window.confirm(`Bill ${activeJobCard.jobCardNumber} for ${form.billingAmount}? Customer outstanding, tax and accounts will be posted.`)) billingMutation.mutate(activeJobCard.id);
      }}>
        <label className="form-field field-span-2"><span>Job card *</span><select required value={form.activeJobCardId} onChange={(event) => selectJobCard(event.target.value)}><option value="">Select an active job card</option>{eligibleJobCards.map((item) => <option key={item.id} value={item.id}>{`${item.jobCardNumber} / ${item.vehicle.registrationNumber} / ${item.customer.name}`}</option>)}</select></label>

        {activeJobCard ? <><div className="selected-record field-span-full"><div><span>Vehicle</span><strong>{activeJobCard.vehicle.registrationNumber}</strong></div><div><span>Status</span><strong>{activeJobCard.status}</strong></div><div><span>Estimate</span><strong>{activeJobCard.estimatedTotal}</strong></div><div><span>Quality check</span><strong>{activeJobCard.qualityCheckedAt ? "Completed" : "Pending"}</strong></div></div><div className="document-actions field-span-full"><Button type="button" variant="outline" onClick={() => company ? printWorkshopJobCard(company, activeJobCard) : window.alert("Document profile is still loading. Please try again.")}>Print job card / estimate</Button></div></> : null}

        {stage === "inspection" ? <>
          <label className="form-field field-span-2"><span>Diagnosis *</span><textarea required rows={3} value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} /></label>
          <label className="form-field field-span-2"><span>Work performed / planned</span><textarea rows={3} value={form.workNotes} onChange={(event) => setForm({ ...form, workNotes: event.target.value })} /></label>
          <label className="form-field field-span-2"><span>Inspection notes *</span><textarea required rows={3} value={form.inspectionNotes} onChange={(event) => setForm({ ...form, inspectionNotes: event.target.value })} /></label>
          <div className="checklist-field field-span-2"><span>Inspection checklist</span><label><input type="checkbox" checked={form.complaintVerified} onChange={(event) => setForm({ ...form, complaintVerified: event.target.checked })} /> Complaint verified</label><label><input type="checkbox" checked={form.roadTestCompleted} onChange={(event) => setForm({ ...form, roadTestCompleted: event.target.checked })} /> Road test completed</label><label><input type="checkbox" checked={form.qualityCheckCompleted} onChange={(event) => setForm({ ...form, qualityCheckCompleted: event.target.checked })} /> Final quality check completed</label></div>
          <label className="form-field"><span>Technician status</span><select value={form.technicianStatus} onChange={(event) => setForm({ ...form, technicianStatus: event.target.value })}><option value="ASSIGNED">Assigned</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="ON_HOLD">On hold</option><option value="PENDING">Pending</option></select></label>
          <label className="form-field"><span>Technician notes</span><input value={form.technicianNotes} onChange={(event) => setForm({ ...form, technicianNotes: event.target.value })} /></label>
          <div className="form-actions field-span-full"><Button type="submit" disabled={!activeJobCard || inspectionMutation.isPending}>{inspectionMutation.isPending ? "Saving..." : "Save inspection"}</Button><Button type="button" variant="outline" disabled={!activeJobCard || technicianMutation.isPending} onClick={() => activeJobCard && technicianMutation.mutate(activeJobCard.id)}>Update technician</Button>{activeJobCard?.qualityCheckedAt ? <Button type="button" variant="outline" onClick={() => statusMutation.mutate({ id: activeJobCard.id, status: "READY" })}>Mark vehicle ready</Button> : null}<Button type="button" variant="outline" disabled={!activeJobCard} onClick={() => activeJobCard && window.confirm(`Cancel ${activeJobCard.jobCardNumber}?`) && statusMutation.mutate({ id: activeJobCard.id, status: "CANCELLED" })}>Cancel job card</Button></div>
        </> : null}

        {stage === "parts" ? <>
          <label className="form-field"><span>Issue date *</span><input required type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} /></label>
          <label className="form-field"><span>Issue warehouse *</span><select required value={form.issueWarehouseId} onChange={(event) => setForm({ ...form, issueWarehouseId: event.target.value })}><option value="">Select warehouse</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
          <div className="field-span-full line-preview"><strong>Parts to issue</strong>{activeJobCard?.parts?.length ? activeJobCard.parts.map((part) => <span key={part.id}>{`${part.productVariant.code} - ${part.productVariant.name} / Qty ${part.quantity}`}</span>) : <span>No estimated parts on this job card.</span>}</div>
          <div className="form-actions field-span-full"><Button type="submit" disabled={!activeJobCard?.parts?.length || issueMutation.isPending}>{issueMutation.isPending ? "Posting..." : "Issue parts and post stock"}</Button></div>
        </> : null}

        {stage === "billing" ? <>
          {activeJobCard && !activeJobCard.qualityCheckedAt ? <p className="form-warning field-span-full">Final quality check is pending. Complete Step 2 before billing.</p> : null}
          {activeJobCard?.parts?.length && !activeJobCard.partsIssuedAt ? <p className="form-warning field-span-full">Parts are estimated but not issued. Complete Step 3 before billing.</p> : null}
          <label className="form-field"><span>Billing date *</span><input required type="date" value={form.billingDate} onChange={(event) => setForm({ ...form, billingDate: event.target.value })} /></label>
          <label className="form-field"><span>Taxable billing amount *</span><input required type="number" min="0.01" step="0.01" value={form.billingAmount} onChange={(event) => setForm({ ...form, billingAmount: event.target.value })} /></label>
          <label className="form-field"><span>Tax mode *</span><select required value={form.billingTaxMode} onChange={(event) => setForm({ ...form, billingTaxMode: event.target.value })}><option value="CGST_SGST">CGST + SGST</option><option value="IGST">IGST</option></select></label>
          <label className="form-field"><span>Service tax rate</span><select value={form.serviceTaxRateId} onChange={(event) => setForm({ ...form, serviceTaxRateId: event.target.value })}><option value="">No service tax</option>{taxRates.map((taxRate) => <option key={taxRate.id} value={taxRate.id}>{`${taxRate.name} / IGST ${taxRate.igstRate}%`}</option>)}</select></label>
          <label className="form-field field-span-2"><span>Delivery notes</span><textarea rows={3} value={form.deliveryNotes} onChange={(event) => setForm({ ...form, deliveryNotes: event.target.value })} /></label>
          <div className="form-actions field-span-full"><Button type="submit" disabled={!activeJobCard || !activeJobCard.qualityCheckedAt || Boolean(activeJobCard?.parts?.length && !activeJobCard.partsIssuedAt) || billingMutation.isPending}>{billingMutation.isPending ? "Billing..." : "Post bill and deliver"}</Button></div>
        </> : null}
      </form> : null}

      <div className="queue-heading"><strong>{stage === "intake" ? "Recent job cards" : "Job cards available for this step"}</strong><span>{stage === "intake" ? items.length : eligibleJobCards.length} record(s)</span></div>
      <MasterList items={(stage === "intake" ? items : eligibleJobCards).map((item) => ({ id: item.id, label: `${item.jobCardNumber} / ${item.vehicle.registrationNumber}`, meta: `${item.customer.name} / ${item.status} / Tech ${item.technicianStatus ?? "PENDING"} / ${item.qualityCheckedAt ? "QC done" : "QC pending"} / ${item.partsIssuedAt ? "Parts issued" : "Parts pending"} / ${item.billingNumber ?? "Unbilled"} / ${item.billingAmount ?? item.estimatedTotal}` }))} />
    </article>
  );
}

function ServiceHistoryPanel({ company, items }: { company?: Company; items: JobCard[] }) {
  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-heading"><div><p className="section-kicker dark">Customer documents</p><h2>Service history</h2></div><span className="context-note">Print the original job card or the final tax invoice for completed services.</span></div>
      {items.length ? <ul className="compact-list document-history-list">{items.map((jobCard) => (
        <li key={jobCard.id}>
          <span><strong>{`${jobCard.vehicle.registrationNumber} / ${jobCard.jobCardNumber}`}</strong><small>{`${jobCard.customer.name} / ${jobCard.billingNumber ?? "Unbilled"} / ${jobCard.deliveredAt?.slice(0, 10) ?? jobCard.billedAt?.slice(0, 10) ?? jobCard.jobDate.slice(0, 10)} / Total ${jobCard.billingAmount ?? jobCard.estimatedTotal}`}</small></span>
          <div className="action-buttons"><Button type="button" variant="outline" onClick={() => company ? printWorkshopJobCard(company, jobCard) : window.alert("Document profile is still loading. Please try again.")}>Job card</Button>{jobCard.billingNumber ? <Button type="button" onClick={() => company ? printWorkshopInvoice(company, jobCard) : window.alert("Document profile is still loading. Please try again.")}>Tax invoice</Button> : null}</div>
        </li>
      ))}</ul> : <p className="empty-text">No completed service records yet.</p>}
    </article>
  );
}

function openWorkshopPrintDocument(title: string, body: string) {
  const printWindow = window.open("", "_blank", "width=1000,height=760");
  if (!printWindow) {
    window.alert("The print window was blocked. Allow pop-ups for RAMS and try again.");
    return;
  }

  printWindow.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapePrintHtml(title)}</title><style>
    @page { size: A4; margin: 12mm; } * { box-sizing: border-box; }
    body { margin: 0; color: #17202a; font: 12px Arial, sans-serif; } .document { border: 1px solid #344054; }
    header { display: flex; justify-content: space-between; gap: 24px; padding: 18px; border-bottom: 1px solid #344054; }
    h1 { margin: 0 0 5px; font-size: 23px; } h2 { margin: 0; font-size: 19px; letter-spacing: 1px; }
    p { margin: 3px 0; line-height: 1.4; } .muted { color: #667085; } .num { text-align: right; white-space: nowrap; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #344054; }
    .party { min-height: 118px; padding: 12px 18px; } .party + .party { border-left: 1px solid #344054; }
    .label { margin-bottom: 6px; color: #475467; font-size: 10px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; }
    .notes { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #344054; }
    .note { min-height: 82px; padding: 12px 18px; } .note + .note { border-left: 1px solid #344054; }
    table { width: 100%; border-collapse: collapse; } th, td { padding: 7px 8px; border-right: 1px solid #d0d5dd; border-bottom: 1px solid #d0d5dd; vertical-align: top; }
    th:last-child, td:last-child { border-right: 0; } th { background: #f2f4f7; font-size: 10px; text-transform: uppercase; }
    .totals { margin-left: auto; width: 310px; border-left: 1px solid #344054; }
    .total-row { display: flex; justify-content: space-between; padding: 7px 12px; border-bottom: 1px solid #d0d5dd; }
    .grand { background: #ecfdf3; font-size: 15px; font-weight: 700; }
    .detail-list { display: grid; gap: 4px; padding: 12px 18px; border-bottom: 1px solid #344054; }
    footer { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; padding: 48px 18px 14px; }
    .signature { border-top: 1px solid #344054; padding-top: 6px; text-align: center; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style></head><body>${body}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

function workshopPartyAddress(party: Company | Customer) {
  return [party.addressLine1, party.addressLine2, party.city, party.state, party.pincode].filter(Boolean).map(escapePrintHtml).join(", ");
}

function printWorkshopJobCard(company: Company, jobCard: JobCard) {
  const estimateRows = [
    ...(jobCard.parts ?? []).map((part) => `<tr><td>Part</td><td>${escapePrintHtml(`${part.productVariant.code} - ${part.productVariant.name}`)}</td><td class="num">${escapePrintHtml(part.quantity)}</td><td class="num">${invoiceAmount(part.estimatedRate)}</td><td class="num">${invoiceAmount(part.estimatedAmount)}</td></tr>`),
    ...(jobCard.laborLines ?? []).map((labor) => `<tr><td>Labor</td><td>${escapePrintHtml(labor.description)}</td><td class="num">1</td><td class="num">${invoiceAmount(labor.estimatedAmount)}</td><td class="num">${invoiceAmount(labor.estimatedAmount)}</td></tr>`),
  ].join("") || `<tr><td colspan="5" class="muted">No part or labor estimate recorded.</td></tr>`;
  const companyAddress = workshopPartyAddress(company) || "Business address not configured";
  const customerAddress = workshopPartyAddress(jobCard.customer) || "Address not configured";
  const body = `<main class="document"><header><div><h1>${escapePrintHtml(company.legalName || company.name)}</h1><p>${companyAddress}</p><p>Phone: ${escapePrintHtml(company.phone || "-")} &nbsp; GSTIN: ${escapePrintHtml(company.gstin || "Not configured")}</p></div><div class="num"><h2>JOB CARD / ESTIMATE</h2><p><strong>${escapePrintHtml(jobCard.jobCardNumber)}</strong></p><p>Date: ${escapePrintHtml(new Date(jobCard.jobDate).toLocaleDateString("en-IN"))}</p><p>Status: ${escapePrintHtml(jobCard.status)}</p></div></header>
  <section class="parties"><div class="party"><div class="label">Customer</div><p><strong>${escapePrintHtml(jobCard.customer.name)}</strong></p><p>${customerAddress}</p><p>Phone: ${escapePrintHtml(jobCard.customer.phone || "-")}</p><p>GSTIN: ${escapePrintHtml(jobCard.customer.gstin || "Unregistered")}</p></div><div class="party"><div class="label">Vehicle</div><p><strong>${escapePrintHtml(jobCard.vehicle.registrationNumber)}</strong></p><p>${escapePrintHtml(`${jobCard.vehicle.brand} ${jobCard.vehicle.model}${jobCard.vehicle.variant ? ` ${jobCard.vehicle.variant}` : ""}`)}</p><p>Odometer: ${escapePrintHtml(jobCard.odometerReading ?? 0)} &nbsp; Fuel: ${escapePrintHtml(jobCard.fuelLevel || "-")}</p><p>Advisor: ${escapePrintHtml(jobCard.advisor?.name || "-")} &nbsp; Technician: ${escapePrintHtml(jobCard.technician?.name || "-")}</p></div></section>
  <section class="notes"><div class="note"><div class="label">Customer complaint</div><p>${escapePrintHtml(jobCard.complaint)}</p></div><div class="note"><div class="label">Initial diagnosis / work notes</div><p>${escapePrintHtml(jobCard.diagnosis || jobCard.workNotes || "Pending inspection")}</p></div></section>
  <table><thead><tr><th>Type</th><th>Description</th><th>Qty</th><th>Rate</th><th>Estimate</th></tr></thead><tbody>${estimateRows}</tbody></table><div class="totals"><div class="total-row"><span>Parts estimate</span><strong>${invoiceAmount(jobCard.estimatedPartsTotal)}</strong></div><div class="total-row"><span>Labor estimate</span><strong>${invoiceAmount(jobCard.estimatedLaborTotal)}</strong></div><div class="total-row grand"><span>Estimated total</span><span>${invoiceAmount(jobCard.estimatedTotal)}</span></div></div>
  <div class="detail-list"><strong>Customer approval</strong><span class="muted">This is an estimate. Additional work or parts require customer approval and may change the final amount.</span></div><footer><div class="signature">Customer signature</div><div class="signature">Service advisor</div></footer></main>`;
  openWorkshopPrintDocument(`${jobCard.jobCardNumber} - Job Card`, body);
}

function printWorkshopInvoice(company: Company, jobCard: JobCard) {
  if (!jobCard.billingNumber) {
    window.alert("This job card has not been billed yet.");
    return;
  }
  const companyAddress = workshopPartyAddress(company) || "Business address not configured";
  const customerAddress = workshopPartyAddress(jobCard.customer) || "Address not configured";
  const detailLines = [...(jobCard.parts ?? []).map((part) => `Part: ${part.productVariant.code} - ${part.productVariant.name} / Qty ${part.quantity}`), ...(jobCard.laborLines ?? []).map((labor) => `Labor: ${labor.description}`)];
  const billedDate = jobCard.billedAt ? new Date(jobCard.billedAt) : new Date(jobCard.jobDate);
  const body = `<main class="document"><header><div><h1>${escapePrintHtml(company.legalName || company.name)}</h1><p>${companyAddress}</p><p>Phone: ${escapePrintHtml(company.phone || "-")} &nbsp; Email: ${escapePrintHtml(company.email || "-")}</p><p><strong>GSTIN: ${escapePrintHtml(company.gstin || "Not configured")}</strong></p></div><div class="num"><h2>TAX INVOICE</h2><p><strong>${escapePrintHtml(jobCard.billingNumber)}</strong></p><p>Date: ${escapePrintHtml(billedDate.toLocaleDateString("en-IN"))}</p><p>Job card: ${escapePrintHtml(jobCard.jobCardNumber)}</p></div></header>
  <section class="parties"><div class="party"><div class="label">Bill to</div><p><strong>${escapePrintHtml(jobCard.customer.name)}</strong></p><p>${customerAddress}</p><p>Phone: ${escapePrintHtml(jobCard.customer.phone || "-")}</p><p>GSTIN: ${escapePrintHtml(jobCard.customer.gstin || "Unregistered")}</p></div><div class="party"><div class="label">Vehicle & supply</div><p><strong>${escapePrintHtml(jobCard.vehicle.registrationNumber)}</strong></p><p>${escapePrintHtml(`${jobCard.vehicle.brand} ${jobCard.vehicle.model}`)}</p><p>Place of supply: ${escapePrintHtml(jobCard.customer.placeOfSupply || jobCard.customer.state || "Not configured")}</p><p>Tax mode: ${escapePrintHtml(jobCard.billingTaxMode === "IGST" ? "IGST" : "CGST + SGST")}</p></div></section>
  <table><thead><tr><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th><th>Taxable</th></tr></thead><tbody><tr><td><strong>Vehicle service and parts as per ${escapePrintHtml(jobCard.jobCardNumber)}</strong></td><td>${escapePrintHtml(jobCard.billingHsnCode || "-")}</td><td class="num">1</td><td class="num">${invoiceAmount(jobCard.billingTaxableAmount)}</td><td class="num">${invoiceAmount(jobCard.billingTaxableAmount)}</td></tr></tbody></table>
  <div class="detail-list"><strong>Service details</strong>${detailLines.length ? detailLines.map((line) => `<span>${escapePrintHtml(line)}</span>`).join("") : `<span class="muted">Service details recorded in the job card.</span>`}</div><div class="totals"><div class="total-row"><span>Taxable amount</span><strong>${invoiceAmount(jobCard.billingTaxableAmount)}</strong></div><div class="total-row"><span>CGST</span><strong>${invoiceAmount(jobCard.billingCgstAmount)}</strong></div><div class="total-row"><span>SGST</span><strong>${invoiceAmount(jobCard.billingSgstAmount)}</strong></div><div class="total-row"><span>IGST</span><strong>${invoiceAmount(jobCard.billingIgstAmount)}</strong></div><div class="total-row"><span>Total tax</span><strong>${invoiceAmount(jobCard.billingTotalTaxAmount)}</strong></div><div class="total-row grand"><span>Grand total</span><span>${invoiceAmount(jobCard.billingAmount)}</span></div></div>
  <div class="detail-list"><span>Narration: ${escapePrintHtml(jobCard.deliveryNotes || "Workshop service completed and vehicle delivered.")}</span><span class="muted">Amount values are in ${escapePrintHtml(company.baseCurrency || "INR")}.</span></div><footer><div><span class="muted">Computer-generated invoice from RAMS ERP.</span></div><div class="signature">Authorised signatory</div></footer></main>`;
  openWorkshopPrintDocument(`${jobCard.billingNumber} - Workshop Tax Invoice`, body);
}

function UnitMasterPanel({ items }: { items: Unit[] }) {
  const [form, setForm] = useState({ code: "", name: "", symbol: "" });
  const [editingId, setEditingId] = useState("");
  const mutation = useCreateMaster("/masters/units", ["units", "master-summary"], () =>
    setForm({ code: "", name: "", symbol: "" }),
  );
  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/masters/units/${editingId}`, form);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["units"] }),
        queryClient.invalidateQueries({ queryKey: ["master-summary"] }),
      ]);
      setEditingId("");
      setForm({ code: "", name: "", symbol: "" });
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/masters/units/${id}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["units"] }),
        queryClient.invalidateQueries({ queryKey: ["master-summary"] }),
      ]);
    },
  });

  return (
    <article className="setup-panel master-panel">
      <h2>Units</h2>
      <form
        className="compact-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (editingId) {
            updateMutation.mutate();
            return;
          }
          mutation.mutate(form);
        }}
      >
        <input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="Symbol" value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending || updateMutation.isPending}>
          {editingId ? "Save" : "Add"}
        </Button>
        {editingId ? (
          <Button type="button" variant="outline" onClick={() => {
            setEditingId("");
            setForm({ code: "", name: "", symbol: "" });
          }}>
            Cancel
          </Button>
        ) : null}
      </form>
      <EditableMasterList
        items={items.map((item) => ({ id: item.id, label: item.name, meta: `${item.symbol} / ${item.status ?? "ACTIVE"}`, raw: item }))}
        onDeactivate={(id) => deactivateMutation.mutate(id)}
        onEdit={(item) => {
          setEditingId(item.id);
          setForm({ code: item.raw.code, name: item.raw.name, symbol: item.raw.symbol });
        }}
      />
    </article>
  );
}

function HsnMasterPanel({ items }: { items: HsnCode[] }) {
  const [form, setForm] = useState({ code: "", description: "" });
  const [editingId, setEditingId] = useState("");
  const mutation = useCreateMaster("/masters/hsn-codes", ["hsn-codes", "master-summary"], () =>
    setForm({ code: "", description: "" }),
  );
  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/masters/hsn-codes/${editingId}`, form);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["hsn-codes"] }),
        queryClient.invalidateQueries({ queryKey: ["master-summary"] }),
      ]);
      setEditingId("");
      setForm({ code: "", description: "" });
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/masters/hsn-codes/${id}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["hsn-codes"] }),
        queryClient.invalidateQueries({ queryKey: ["master-summary"] }),
      ]);
    },
  });

  return (
    <article className="setup-panel master-panel">
      <h2>HSN Codes</h2>
      <form
        className="compact-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (editingId) {
            updateMutation.mutate();
            return;
          }
          mutation.mutate(form);
        }}
      >
        <input placeholder="HSN" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending || updateMutation.isPending}>
          {editingId ? "Save" : "Add"}
        </Button>
        {editingId ? (
          <Button type="button" variant="outline" onClick={() => {
            setEditingId("");
            setForm({ code: "", description: "" });
          }}>
            Cancel
          </Button>
        ) : null}
      </form>
      <EditableMasterList
        items={items.map((item) => ({ id: item.id, label: item.description, meta: `${item.code} / ${item.status ?? "ACTIVE"}`, raw: item }))}
        onDeactivate={(id) => deactivateMutation.mutate(id)}
        onEdit={(item) => {
          setEditingId(item.id);
          setForm({ code: item.raw.code, description: item.raw.description });
        }}
      />
    </article>
  );
}

function TaxRatePanel({ hsnCodes, items }: { hsnCodes: HsnCode[]; items: TaxRate[] }) {
  const [form, setForm] = useState({
    name: "GST 18%",
    hsnCodeId: "",
    cgstRate: "9",
    sgstRate: "9",
    igstRate: "18",
  });
  const [editingId, setEditingId] = useState("");
  const taxRateKeys = ["tax-rates", "master-summary"];
  const mutation = useCreateMaster("/masters/tax-rates", taxRateKeys, () => undefined);
  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/masters/tax-rates/${editingId}`, form);
    },
    onSuccess: async () => {
      await invalidateKeys(taxRateKeys);
      setEditingId("");
      setForm({ name: "GST 18%", hsnCodeId: "", cgstRate: "9", sgstRate: "9", igstRate: "18" });
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/masters/tax-rates/${id}`);
    },
    onSuccess: async () => {
      await invalidateKeys(taxRateKeys);
    },
  });

  return (
    <article className="setup-panel master-panel">
      <h2>Tax Rates</h2>
      <form
        className="compact-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (editingId) {
            updateMutation.mutate();
            return;
          }
          mutation.mutate(form);
        }}
      >
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <select value={form.hsnCodeId} onChange={(event) => setForm({ ...form, hsnCodeId: event.target.value })}>
          <option value="">No HSN</option>
          {hsnCodes.map((hsn) => <option key={hsn.id} value={hsn.id}>{hsn.code}</option>)}
        </select>
        <input placeholder="CGST" value={form.cgstRate} onChange={(event) => setForm({ ...form, cgstRate: event.target.value })} />
        <input placeholder="SGST" value={form.sgstRate} onChange={(event) => setForm({ ...form, sgstRate: event.target.value })} />
        <input placeholder="IGST" value={form.igstRate} onChange={(event) => setForm({ ...form, igstRate: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending || updateMutation.isPending}>
          {editingId ? "Save" : "Add"}
        </Button>
        {editingId ? (
          <Button type="button" variant="outline" onClick={() => {
            setEditingId("");
            setForm({ name: "GST 18%", hsnCodeId: "", cgstRate: "9", sgstRate: "9", igstRate: "18" });
          }}>
            Cancel
          </Button>
        ) : null}
      </form>
      <EditableMasterList
        items={items.map((item) => ({ id: item.id, label: item.name, meta: `${item.igstRate}% / ${item.status ?? "ACTIVE"}`, raw: item }))}
        onDeactivate={(id) => deactivateMutation.mutate(id)}
        onEdit={(item) => {
          setEditingId(item.id);
          setForm({
            name: item.raw.name,
            hsnCodeId: item.raw.hsnCodeId ?? "",
            cgstRate: String(item.raw.cgstRate),
            sgstRate: String(item.raw.sgstRate),
            igstRate: String(item.raw.igstRate),
          });
        }}
      />
    </article>
  );
}

function ProductPanel({
  brands,
  categories,
  hsnCodes,
  items,
  taxRates,
  units,
}: {
  brands: Brand[];
  categories: Category[];
  hsnCodes: HsnCode[];
  items: Product[];
  taxRates: TaxRate[];
  units: Unit[];
}) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    brandId: "",
    categoryId: "",
    unitId: "",
    hsnCodeId: "",
    taxRateId: "",
    reorderLevel: "0",
  });
  const [editingId, setEditingId] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pagedProducts = usePagedMasterList<Product>("products-page", "/masters/products/page", page, search);
  const displayProducts = pagedProducts.data?.items ?? items;
  const mutation = useCreateMaster("/masters/products", ["products", "master-summary"], () =>
    setForm({ ...form, code: "", name: "", reorderLevel: "0" }),
  );
  const productKeys = ["products", "products-page", "master-summary", "reorder-items"];
  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/masters/products/${editingId}`, form);
    },
    onSuccess: async () => {
      await invalidateKeys(productKeys);
      setEditingId("");
      setForm({
        code: "",
        name: "",
        brandId: "",
        categoryId: "",
        unitId: "",
        hsnCodeId: "",
        taxRateId: "",
        reorderLevel: "0",
      });
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/masters/products/${id}`);
    },
    onSuccess: async () => {
      await invalidateKeys(productKeys);
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-title-row">
        <h2>Products</h2>
        <div className="button-row">
          <Button type="button" variant="outline" onClick={() => downloadCsv("/masters/products/import-template.csv")}>Template</Button>
          <Button type="button" variant="outline" onClick={() => downloadCsv("/masters/products/export.csv")}>Export CSV</Button>
        </div>
      </div>
      <form
        className="compact-form product-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (editingId) {
            updateMutation.mutate();
            return;
          }
          mutation.mutate(form);
        }}
      >
        <input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <select value={form.brandId} onChange={(event) => setForm({ ...form, brandId: event.target.value })}>
          <option value="">No brand</option>
          {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </select>
        <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
          <option value="">Category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select value={form.unitId} onChange={(event) => setForm({ ...form, unitId: event.target.value })}>
          <option value="">Unit</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
        <select value={form.hsnCodeId} onChange={(event) => setForm({ ...form, hsnCodeId: event.target.value })}>
          <option value="">HSN</option>
          {hsnCodes.map((hsn) => <option key={hsn.id} value={hsn.id}>{hsn.code}</option>)}
        </select>
        <select value={form.taxRateId} onChange={(event) => setForm({ ...form, taxRateId: event.target.value })}>
          <option value="">Tax rate</option>
          {taxRates.map((tax) => <option key={tax.id} value={tax.id}>{tax.name}</option>)}
        </select>
        <input placeholder="Reorder" value={form.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending || updateMutation.isPending}>
          {editingId ? "Save" : "Add"}
        </Button>
        {editingId ? (
          <Button type="button" variant="outline" onClick={() => {
            setEditingId("");
            setForm({
              code: "",
              name: "",
              brandId: "",
              categoryId: "",
              unitId: "",
              hsnCodeId: "",
              taxRateId: "",
              reorderLevel: "0",
            });
          }}>
            Cancel
          </Button>
        ) : null}
      </form>
      <PagedEditableMasterList
        isLoading={pagedProducts.isLoading}
        page={pagedProducts.data?.page ?? page}
        pageCount={pagedProducts.data?.pageCount ?? 1}
        total={pagedProducts.data?.total ?? displayProducts.length}
        search={search}
        onSearchChange={setSearch}
        onPageChange={setPage}
        items={displayProducts.map((item) => ({ id: item.id, label: item.name, meta: `${item.code} / ${item.status ?? "ACTIVE"}`, raw: item }))}
        onDeactivate={(id) => deactivateMutation.mutate(id)}
        onEdit={(item) => {
          setEditingId(item.id);
          setForm({
            code: item.raw.code,
            name: item.raw.name,
            brandId: item.raw.brandId ?? "",
            categoryId: item.raw.categoryId,
            unitId: item.raw.unitId,
            hsnCodeId: item.raw.hsnCodeId ?? "",
            taxRateId: item.raw.taxRateId ?? "",
            reorderLevel: String(item.raw.reorderLevel ?? "0"),
          });
        }}
      />
    </article>
  );
}

function VariantPanel({ items, products }: { items: ProductVariant[]; products: Product[] }) {
  const [form, setForm] = useState({
    productId: "",
    code: "",
    name: "",
    salePrice: "0",
    purchasePrice: "0",
  });
  const [editingId, setEditingId] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pagedVariants = usePagedMasterList<ProductVariant>("product-variants-page", "/masters/product-variants/page", page, search);
  const displayVariants = pagedVariants.data?.items ?? items;
  const mutation = useCreateMaster("/masters/product-variants", ["product-variants", "master-summary"], () =>
    setForm({ ...form, code: "", name: "", salePrice: "0", purchasePrice: "0" }),
  );
  const variantKeys = ["product-variants", "product-variants-page", "master-summary", "reorder-items"];
  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/masters/product-variants/${editingId}`, form);
    },
    onSuccess: async () => {
      await invalidateKeys(variantKeys);
      setEditingId("");
      setForm({ productId: "", code: "", name: "", salePrice: "0", purchasePrice: "0" });
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/masters/product-variants/${id}`);
    },
    onSuccess: async () => {
      await invalidateKeys(variantKeys);
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <div className="panel-title-row">
        <h2>Product Variants</h2>
        <div className="button-row">
          <Button type="button" variant="outline" onClick={() => downloadCsv("/masters/product-variants/import-template.csv")}>Template</Button>
          <Button type="button" variant="outline" onClick={() => downloadCsv("/masters/product-variants/export.csv")}>Export CSV</Button>
        </div>
      </div>
      <form
        className="compact-form product-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (editingId) {
            updateMutation.mutate();
            return;
          }
          mutation.mutate(form);
        }}
      >
        <select value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}>
          <option value="">Product</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
        <input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="Sale price" value={form.salePrice} onChange={(event) => setForm({ ...form, salePrice: event.target.value })} />
        <input placeholder="Purchase price" value={form.purchasePrice} onChange={(event) => setForm({ ...form, purchasePrice: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending || updateMutation.isPending}>
          {editingId ? "Save" : "Add"}
        </Button>
        {editingId ? (
          <Button type="button" variant="outline" onClick={() => {
            setEditingId("");
            setForm({ productId: "", code: "", name: "", salePrice: "0", purchasePrice: "0" });
          }}>
            Cancel
          </Button>
        ) : null}
      </form>
      <PagedEditableMasterList
        isLoading={pagedVariants.isLoading}
        page={pagedVariants.data?.page ?? page}
        pageCount={pagedVariants.data?.pageCount ?? 1}
        total={pagedVariants.data?.total ?? displayVariants.length}
        search={search}
        onSearchChange={setSearch}
        onPageChange={setPage}
        items={displayVariants.map((item) => ({ id: item.id, label: item.name, meta: `${item.code} / ${item.salePrice} / ${item.status ?? "ACTIVE"}`, raw: item }))}
        onDeactivate={(id) => deactivateMutation.mutate(id)}
        onEdit={(item) => {
          setEditingId(item.id);
          setForm({
            productId: item.raw.productId,
            code: item.raw.code,
            name: item.raw.name,
            salePrice: String(item.raw.salePrice),
            purchasePrice: String(item.raw.purchasePrice ?? "0"),
          });
        }}
      />
    </article>
  );
}

function MasterList({ items }: { items: Array<{ id: string; label: string; meta: string }> }) {
  const [search, setSearch] = useState("");
  const visibleItems = search.trim()
    ? items.filter((item) => `${item.label} ${item.meta}`.toLowerCase().includes(search.trim().toLowerCase()))
    : items;

  if (items.length === 0) {
    return <p className="empty-text">No records yet.</p>;
  }

  return (
    <>
      <div className="list-toolbar">
        <input className="list-search" placeholder="Search records" value={search} onChange={(event) => setSearch(event.target.value)} />
        <span>{`${visibleItems.length} of ${items.length}`}</span>
      </div>
      {visibleItems.length === 0 ? <p className="empty-text">No matching records.</p> : null}
      <div className="record-list-head" aria-hidden="true"><span>Record</span><span>Details</span></div>
      <ul className="compact-list record-list">
        {visibleItems.slice(0, 8).map((item) => (
          <li key={item.id}>
            <span className="record-title">{item.label}</span>
            <strong>{item.meta}</strong>
          </li>
        ))}
      </ul>
    </>
  );
}

function EditableMasterList<T extends { id: string }>({
  items,
  onDeactivate,
  onEdit,
}: {
  items: Array<{ id: string; label: string; meta: string; raw: T }>;
  onDeactivate: (id: string) => void;
  onEdit: (item: { id: string; label: string; meta: string; raw: T }) => void;
}) {
  const [search, setSearch] = useState("");
  const visibleItems = search.trim()
    ? items.filter((item) => `${item.label} ${item.meta}`.toLowerCase().includes(search.trim().toLowerCase()))
    : items;

  if (items.length === 0) {
    return <p className="empty-text">No records yet.</p>;
  }

  return (
    <>
      <input
        className="list-search"
        placeholder="Search records"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {visibleItems.length === 0 ? <p className="empty-text">No matching records.</p> : null}
      <ul className="compact-list action-list">
        {visibleItems.slice(0, 8).map((item) => (
          <li key={item.id}>
            <span>{item.label}</span>
            <strong>{item.meta}</strong>
            <Button type="button" variant="outline" onClick={() => onEdit(item)}>
              Edit
            </Button>
            <Button type="button" variant="outline" onClick={() => onDeactivate(item.id)}>
              Deactivate
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}

function PagedEditableMasterList<T extends { id: string }>({
  isLoading,
  items,
  onDeactivate,
  onEdit,
  onPageChange,
  onSearchChange,
  page,
  pageCount,
  search,
  total,
}: {
  isLoading: boolean;
  items: Array<{ id: string; label: string; meta: string; raw: T }>;
  onDeactivate: (id: string) => void;
  onEdit: (item: { id: string; label: string; meta: string; raw: T }) => void;
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  page: number;
  pageCount: number;
  search: string;
  total: number;
}) {
  return (
    <>
      <input
        className="list-search"
        placeholder="Search records"
        value={search}
        onChange={(event) => {
          onSearchChange(event.target.value);
          onPageChange(1);
        }}
      />
      {isLoading ? <p className="empty-text">Loading records...</p> : null}
      {!isLoading && total === 0 ? <p className="empty-text">No records yet.</p> : null}
      <ul className="compact-list action-list">
        {items.map((item) => (
          <li key={item.id}>
            <span>{item.label}</span>
            <strong>{item.meta}</strong>
            <Button type="button" variant="outline" onClick={() => onEdit(item)}>
              Edit
            </Button>
            <Button type="button" variant="outline" onClick={() => onDeactivate(item.id)}>
              Deactivate
            </Button>
          </li>
        ))}
      </ul>
      <div className="pagination-row">
        <Button type="button" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </Button>
        <span>{`Page ${page} of ${Math.max(pageCount, 1)} / ${total} records`}</span>
        <Button type="button" variant="outline" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </>
  );
}

function useCreateMaster(path: string, queryKeys: string[], onSuccess?: () => void) {
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      await api.post(path, payload);
    },
    onSuccess: async () => {
      await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] })));
      onSuccess?.();
    },
  });
}

async function invalidateKeys(queryKeys: string[]) {
  await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] })));
}

async function invalidatePostingQueries(extraKeys: string[] = []) {
  await Promise.all([
    ...extraKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] })),
    queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] }),
    queryClient.invalidateQueries({ queryKey: ["sales-invoices"] }),
    queryClient.invalidateQueries({ queryKey: ["purchase-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["sales-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["inventory-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["stock-balances"] }),
    queryClient.invalidateQueries({ queryKey: ["stock-movements"] }),
    queryClient.invalidateQueries({ queryKey: ["accounting-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
    queryClient.invalidateQueries({ queryKey: ["trial-balance"] }),
    queryClient.invalidateQueries({ queryKey: ["general-ledger"] }),
    queryClient.invalidateQueries({ queryKey: ["profit-and-loss"] }),
    queryClient.invalidateQueries({ queryKey: ["balance-sheet"] }),
    queryClient.invalidateQueries({ queryKey: ["party-ledger"] }),
    queryClient.invalidateQueries({ queryKey: ["party-ledger-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["party-outstanding"] }),
    queryClient.invalidateQueries({ queryKey: ["gst-summary"] }),
  ]);
}

function ReadinessMetric({ label, value }: { label: string; value?: number | string }) {
  return (
    <div className="readiness-metric">
      <span>{label}</span>
      <strong>{value ?? "..."}</strong>
    </div>
  );
}

function FinancialYearPanel({ financialYears }: { financialYears: FinancialYear[] }) {
  const [form, setForm] = useState({
    name: "2026-2027",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/financial-years", form);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["financial-years"] });
      await queryClient.invalidateQueries({ queryKey: ["system-status"] });
    },
  });

  return (
    <article className="setup-panel wide-panel">
      <div className="panel-heading"><div><p className="section-kicker dark">Posting control</p><h2>Financial years</h2></div><span className="context-note">Transactions can only be posted inside an open period.</span></div>
      <form className="labeled-form settings-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <label className="form-field"><span>Year name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className="form-field"><span>Start date</span><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
        <label className="form-field"><span>End date</span><input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={mutation.isPending}>Add financial year</Button></div>
      </form>
      <ul className="compact-list">
        {financialYears.map((year) => (
          <li key={year.id}>
            <span>{year.name}</span>
            <strong>{year.status}</strong>
          </li>
        ))}
      </ul>
    </article>
  );
}

function NumberSeriesPanel({ numberSeries }: { numberSeries: NumberSeries[] }) {
  const [form, setForm] = useState({
    documentType: "SALES_INVOICE",
    prefix: "SI-",
    suffix: "",
    padding: 5,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/number-series", form);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["number-series"] });
      await queryClient.invalidateQueries({ queryKey: ["system-status"] });
    },
  });
  const seedMutation = useMutation({
    mutationFn: async () => {
      await api.post("/settings/seed-operational-defaults");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["number-series"] }),
        queryClient.invalidateQueries({ queryKey: ["system-status"] }),
        queryClient.invalidateQueries({ queryKey: ["payment-modes"] }),
        queryClient.invalidateQueries({ queryKey: ["commercial-master-summary"] }),
      ]);
    },
  });

  return (
    <article className="setup-panel wide-panel">
      <div className="panel-title-row">
        <div><p className="section-kicker dark">Document identity</p><h2>Number series</h2></div>
        <Button type="button" variant="outline" disabled={seedMutation.isPending} onClick={() => seedMutation.mutate()}>
          Seed Defaults
        </Button>
      </div>
      <form className="labeled-form settings-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <label className="form-field"><span>Document type</span><input value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value })} /></label>
        <label className="form-field"><span>Prefix</span><input value={form.prefix} onChange={(event) => setForm({ ...form, prefix: event.target.value })} /></label>
        <label className="form-field"><span>Suffix</span><input value={form.suffix} onChange={(event) => setForm({ ...form, suffix: event.target.value })} /></label>
        <div className="form-actions field-span-full"><Button type="submit" disabled={mutation.isPending}>Add number series</Button></div>
      </form>
      <ul className="compact-list">
        {numberSeries.map((series) => (
          <li key={series.id}>
            <span>{series.documentType}</span>
            <strong>{`${series.prefix}${String(series.nextNumber).padStart(series.padding, "0")}${series.suffix}`}</strong>
          </li>
        ))}
      </ul>
    </article>
  );
}

function AuditLogPanel({ items }: { items: AuditLog[] }) {
  return (
    <article className="setup-panel wide-panel">
      <h2>Audit Trail</h2>
      <MasterList
        items={items.map((item) => ({
          id: item.id,
          label: `${item.module} / ${item.action} / ${item.entityType}`,
          meta: `${item.actor?.fullName ?? item.actor?.username ?? "System"} / ${new Date(item.createdAt).toLocaleString()}`,
        }))}
      />
    </article>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <NotificationViewport />
    </QueryClientProvider>
  );
}

function NotificationViewport() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    return subscribeNotifications((notification) => {
      setNotifications((current) => [...current.slice(-2), notification]);
      window.setTimeout(() => {
        setNotifications((current) => current.filter((item) => item.id !== notification.id));
      }, 5000);
    });
  }, []);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-stack" role="status" aria-live="polite">
      {notifications.map((notification) => (
        <div className={`app-notification ${notification.tone}`} key={notification.id}>
          {notification.message}
        </div>
      ))}
    </div>
  );
}

function AppContent() {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const setup = useSetupStatus();
  const currentUser = useCurrentUser();

  if (setup.isLoading) {
    return <AuthPanel title="Loading RAMS" subtitle="Checking system setup.">{null}</AuthPanel>;
  }

  if (setup.data?.requiresBootstrap) {
    return <SetupForm />;
  }

  if (!currentUser.data) {
    return authMode === "register"
      ? <RegisterForm onLogin={() => setAuthMode("login")} />
      : <LoginForm onRegister={() => setAuthMode("register")} />;
  }

  return <DashboardShell user={currentUser.data} />;
}

export default App;
