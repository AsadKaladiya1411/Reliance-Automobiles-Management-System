import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AxiosError } from "axios";
import { QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { api, type ApiEnvelope } from "@/lib/api";
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
  city?: string | null;
  state?: string | null;
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
  grandTotal: string | number;
  status: string;
  customer: Customer;
  warehouse: Warehouse;
  salesOrder?: SalesOrder | null;
  deliveryChallan?: DeliveryChallan | null;
  lines: Array<{ id: string; productVariant: ProductVariant; quantity: string | number; lineTotal?: string | number }>;
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
  partsIssuedAt?: string | null;
  billingNumber?: string | null;
  billingTaxMode?: string;
  billingTaxableAmount?: string | number;
  billingTotalTaxAmount?: string | number;
  billingAmount?: string | number;
  billedAt?: string | null;
  customer: Customer;
  vehicle: Vehicle;
  technician?: Employee | null;
};

type AppView = "dashboard" | "masters" | "inventory" | "workshop" | "transactions" | "reports" | "settings";

const navItems: Array<{ id: AppView; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "DB" },
  { id: "masters", label: "Masters", icon: "MS" },
  { id: "inventory", label: "Inventory", icon: "IN" },
  { id: "workshop", label: "Workshop", icon: "WS" },
  { id: "transactions", label: "Transactions", icon: "TR" },
  { id: "reports", label: "Reports", icon: "RP" },
  { id: "settings", label: "Settings", icon: "ST" },
];

const viewPermissions: Record<AppView, string[]> = {
  dashboard: ["dashboard:read"],
  masters: ["masters:read"],
  inventory: ["inventory:read"],
  workshop: ["workshop:read"],
  transactions: ["purchase:read", "sales:read", "accounting:read"],
  reports: ["reports:read", "accounting:read", "gst:read"],
  settings: ["settings:read", "company:read"],
};

function canAccessView(user: AuthUser, view: AppView) {
  if (user.roles.includes("SUPER_ADMIN")) {
    return true;
  }

  return viewPermissions[view].some((permission) => user.permissions.includes(permission));
}

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
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Foundation milestone</p>
            <h1>Reliance Automobiles Management System</h1>
          </div>
          <div className="user-actions">
            <span>{user.fullName}</span>
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
        <h2>Workshop</h2>
        <p>Job cards, vehicle complaints, service status, estimated parts, and labor tracking.</p>
      </section>
      <section className="setup-panel">
        <h2>Workshop Readiness</h2>
        <WorkshopReadinessGrid workshopSummary={workshopSummary} />
      </section>
      <section className="masters-grid">
        <JobCardPanel
          customers={customers.data ?? []}
          employees={employees.data ?? []}
          items={jobCards.data ?? []}
          taxRates={taxRates.data ?? []}
          variants={variants.data ?? []}
          vehicles={vehicles.data ?? []}
          warehouses={warehouses.data ?? []}
        />
        <ServiceHistoryPanel items={serviceHistory.data ?? []} />
      </section>
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
        <h2>Masters</h2>
        <p>Core master data required before inventory, purchase, sales, and workshop transactions.</p>
      </section>
      <section className="setup-panel">
        <h2>Master Data Readiness</h2>
        <MasterReadinessGrid masterSummary={masterSummary} />
      </section>
      <section className="setup-panel">
        <h2>Commercial Master Readiness</h2>
        <CommercialReadinessGrid commercialMasterSummary={commercialMasterSummary} />
      </section>
      <section className="masters-grid">
        <CustomerPanel items={customers.data ?? []} />
        <SupplierPanel items={suppliers.data ?? []} />
        <EmployeePanel items={employees.data ?? []} />
        <PaymentModePanel items={paymentModes.data ?? []} />
        <VehiclePanel customers={customers.data ?? []} items={vehicles.data ?? []} />
        <UnitMasterPanel items={units.data ?? []} />
        <HsnMasterPanel items={hsnCodes.data ?? []} />
        <TaxRatePanel hsnCodes={hsnCodes.data ?? []} items={taxRates.data ?? []} />
        <SimpleCodeNamePanel
          items={brands.data ?? []}
          path="/masters/brands"
          queryKeys={["brands", "master-summary"]}
          title="Brands"
        />
        <SimpleCodeNamePanel
          items={categories.data ?? []}
          path="/masters/categories"
          queryKeys={["categories", "master-summary"]}
          title="Categories"
        />
        <ProductPanel
          brands={brands.data ?? []}
          categories={categories.data ?? []}
          hsnCodes={hsnCodes.data ?? []}
          items={products.data ?? []}
          taxRates={taxRates.data ?? []}
          units={units.data ?? []}
        />
        <VariantPanel items={variants.data ?? []} products={products.data ?? []} />
        <SimpleCodeNamePanel
          items={warehouses.data ?? []}
          path="/masters/warehouses"
          queryKeys={["warehouses", "master-summary"]}
          title="Warehouses"
        />
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
        <h2>Transactions</h2>
        <p>Purchase, sales, workshop, accounting, and GST posting workflows will be added here incrementally.</p>
      </section>
      <section className="setup-panel">
        <h2>Accounting Foundation</h2>
        <AccountingReadinessGrid accountingSummary={accountingSummary} />
      </section>
      <section className="setup-panel">
        <h2>Purchase Posting</h2>
        <PurchaseReadinessGrid purchaseSummary={purchaseSummary} />
      </section>
      <section className="setup-panel">
        <h2>Sales Posting</h2>
        <SalesReadinessGrid salesSummary={salesSummary} />
      </section>
      <section className="setup-panel">
        <h2>Ledger and GST Reports</h2>
        <ReportReadinessGrid partyLedgerSummary={partyLedgerSummary} gstSummary={gstSummary} />
      </section>
      <section className="setup-panel">
        <h2>Payments</h2>
        <PaymentReadinessGrid paymentSummary={paymentSummary} />
      </section>
      <section className="masters-grid">
        <PurchaseOrderPanel
          items={purchaseOrders.data ?? []}
          suppliers={suppliers.data ?? []}
          variants={variants.data ?? []}
        />
        <PurchaseInvoicePanel
          grns={grns.data ?? []}
          invoices={purchaseInvoices.data ?? []}
          suppliers={suppliers.data ?? []}
          variants={variants.data ?? []}
          warehouses={warehouses.data ?? []}
        />
        <GoodsReceiptNotePanel
          items={grns.data ?? []}
          orders={purchaseOrders.data ?? []}
          suppliers={suppliers.data ?? []}
          variants={variants.data ?? []}
          warehouses={warehouses.data ?? []}
        />
        <SalesInvoicePanel
          customers={customers.data ?? []}
          deliveryChallans={deliveryChallans.data ?? []}
          invoices={salesInvoices.data ?? []}
          orders={salesOrders.data ?? []}
          variants={variants.data ?? []}
          warehouses={warehouses.data ?? []}
        />
        <SalesQuotationPanel customers={customers.data ?? []} items={salesQuotations.data ?? []} variants={variants.data ?? []} />
        <SalesOrderPanel
          customers={customers.data ?? []}
          items={salesOrders.data ?? []}
          quotations={salesQuotations.data ?? []}
          variants={variants.data ?? []}
        />
        <DeliveryChallanPanel
          customers={customers.data ?? []}
          items={deliveryChallans.data ?? []}
          orders={salesOrders.data ?? []}
          variants={variants.data ?? []}
          warehouses={warehouses.data ?? []}
        />
        <PurchaseReturnPanel invoices={purchaseInvoices.data ?? []} items={purchaseReturns.data ?? []} />
        <SalesReturnPanel invoices={salesInvoices.data ?? []} items={salesReturns.data ?? []} />
        <AccountPanel items={accounts.data ?? []} />
        <JournalPanel accounts={accounts.data ?? []} items={journalEntries.data ?? []} />
        <ContraVoucherPanel accounts={accounts.data ?? []} />
        <TrialBalancePanel trialBalance={trialBalance.data} />
        <GeneralLedgerPanel items={generalLedger.data ?? []} />
        <ProfitAndLossPanel statement={profitAndLoss.data} />
        <BalanceSheetPanel statement={balanceSheet.data} />
        <PaymentPanel
          customers={customers.data ?? []}
          items={payments.data ?? []}
          paymentModes={paymentModes.data ?? []}
          suppliers={suppliers.data ?? []}
        />
        <FinancialNotePanel customers={customers.data ?? []} items={notes.data ?? []} suppliers={suppliers.data ?? []} />
        <OutstandingPanel outstanding={outstanding.data} />
        <PartyLedgerPanel items={partyLedger.data ?? []} />
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
  const roles = useMasterList<AdminRole>("auth-roles", "/auth/roles");
  const users = useMasterList<AdminUser>("auth-users", "/auth/users");
  const approvalRules = useMasterList<ApprovalRule>("approval-rules", "/approvals/rules");
  const approvalRequests = useMasterList<ApprovalRequest>("approval-requests", "/approvals/requests");

  return (
    <>
      <section className="view-header">
        <h2>Settings</h2>
        <p>Company, financial year, and document numbering configuration.</p>
      </section>
      <section className="foundation-grid" aria-label="Foundation setup">
        <article className="setup-panel">
          <h2>Company Profile</h2>
          <dl>
            <div>
              <dt>Name</dt>
              <dd>{company?.name ?? "Loading"}</dd>
            </div>
            <div>
              <dt>GSTIN</dt>
              <dd>{company?.gstin ?? "Not configured"}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{[company?.city, company?.state].filter(Boolean).join(", ") || "Not configured"}</dd>
            </div>
          </dl>
        </article>

        <FinancialYearPanel financialYears={financialYears} />
        <NumberSeriesPanel numberSeries={numberSeries} />
        <UserRolePanel roles={roles.data ?? []} users={users.data ?? []} />
        <ApprovalWorkflowPanel requests={approvalRequests.data ?? []} rules={approvalRules.data ?? []} />
        <AuditLogPanel items={auditLogs} />
      </section>
    </>
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
      <h2>Create Purchase Order</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <select value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}>
          <option value="">Supplier</option>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select>
        <select
          value={form.productVariantId}
          onChange={(event) => setForm({
            ...form,
            productVariantId: event.target.value,
            unitCost: costForVariant(variants, event.target.value),
          })}
        >
          <option value="">Product variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select>
        <input type="date" value={form.orderDate} onChange={(event) => setForm({ ...form, orderDate: event.target.value })} />
        <input type="date" value={form.expectedDate} onChange={(event) => setForm({ ...form, expectedDate: event.target.value })} />
        <input placeholder="Quantity" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        <input placeholder="Unit cost" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} />
        <input placeholder="Narration" value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Create</Button>
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
      <h2>Create GRN</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <select value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value, purchaseOrderId: "" })}>
          <option value="">Supplier</option>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select>
        <select
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
        </select>
        <select value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}>
          <option value="">Warehouse</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select>
        <select value={form.productVariantId} onChange={(event) => setForm({ ...form, productVariantId: event.target.value })}>
          <option value="">Product variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select>
        <input type="date" value={form.grnDate} onChange={(event) => setForm({ ...form, grnDate: event.target.value })} />
        <input placeholder="Quantity" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        <input placeholder="Narration" value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Create</Button>
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
  const [form, setForm] = useState({ code: "", name: "", customerType: "Retail", phone: "", gstin: "", creditLimit: "0", creditDays: "0" });
  const [editingId, setEditingId] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pagedCustomers = usePagedMasterList<Customer>("customers-page", "/commercial-masters/customers/page", page, search);
  const displayCustomers = pagedCustomers.data?.items ?? items;
  const mutation = useCreateMaster("/commercial-masters/customers", ["customers", "commercial-master-summary", "party-outstanding"], () =>
    setForm({ code: "", name: "", customerType: "Retail", phone: "", gstin: "", creditLimit: "0", creditDays: "0" }),
  );
  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/commercial-masters/customers/${editingId}`, form);
    },
    onSuccess: async () => {
      await invalidateKeys(["customers", "customers-page", "commercial-master-summary", "party-outstanding"]);
      setEditingId("");
      setForm({ code: "", name: "", customerType: "Retail", phone: "", gstin: "", creditLimit: "0", creditDays: "0" });
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
        <Button type="button" variant="outline" onClick={() => downloadCsv("/commercial-masters/customers/export.csv")}>Export CSV</Button>
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
        <input placeholder="Type" value={form.customerType} onChange={(event) => setForm({ ...form, customerType: event.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <input placeholder="GSTIN" value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value })} />
        <input placeholder="Credit limit" value={form.creditLimit} onChange={(event) => setForm({ ...form, creditLimit: event.target.value })} />
        <input placeholder="Credit days" value={form.creditDays} onChange={(event) => setForm({ ...form, creditDays: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending || updateMutation.isPending}>
          {editingId ? "Save" : "Add"}
        </Button>
        {editingId ? (
          <Button type="button" variant="outline" onClick={() => {
            setEditingId("");
            setForm({ code: "", name: "", customerType: "Retail", phone: "", gstin: "", creditLimit: "0", creditDays: "0" });
          }}>
            Cancel
          </Button>
        ) : null}
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
        <Button type="button" variant="outline" onClick={() => downloadCsv("/commercial-masters/suppliers/export.csv")}>Export CSV</Button>
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
      <h2>Post Journal Entry</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <input type="date" value={form.entryDate} onChange={(event) => setForm({ ...form, entryDate: event.target.value })} />
        <select value={form.debitAccountId} onChange={(event) => setForm({ ...form, debitAccountId: event.target.value })}>
          <option value="">Debit account</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{`${account.code} - ${account.name}`}</option>)}
        </select>
        <select value={form.creditAccountId} onChange={(event) => setForm({ ...form, creditAccountId: event.target.value })}>
          <option value="">Credit account</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{`${account.code} - ${account.name}`}</option>)}
        </select>
        <input placeholder="Amount" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
        <input placeholder="Narration" value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Post</Button>
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
      <h2>Post Contra Voucher</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <input type="date" value={form.voucherDate} onChange={(event) => setForm({ ...form, voucherDate: event.target.value })} />
        <select value={form.fromAccountId} onChange={(event) => setForm({ ...form, fromAccountId: event.target.value })}>
          <option value="">From account</option>
          {assetAccounts.map((account) => <option key={account.id} value={account.id}>{`${account.code} - ${account.name}`}</option>)}
        </select>
        <select value={form.toAccountId} onChange={(event) => setForm({ ...form, toAccountId: event.target.value })}>
          <option value="">To account</option>
          {assetAccounts.map((account) => <option key={account.id} value={account.id}>{`${account.code} - ${account.name}`}</option>)}
        </select>
        <input placeholder="Amount" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
        <input placeholder="Narration" value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Post</Button>
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
      <h2>Post Purchase Invoice</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <select value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value, goodsReceiptNoteId: "" })}>
          <option value="">Supplier</option>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select>
        <select value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value, goodsReceiptNoteId: "" })}>
          <option value="">Warehouse</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select>
        <select
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
        </select>
        <select
          value={form.productVariantId}
          onChange={(event) => setForm({
            ...form,
            productVariantId: event.target.value,
            unitCost: costForVariant(variants, event.target.value),
          })}
        >
          <option value="">Product variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select>
        <input type="date" value={form.invoiceDate} onChange={(event) => setForm({ ...form, invoiceDate: event.target.value })} />
        <input placeholder="Supplier bill no." value={form.supplierBillNumber} onChange={(event) => setForm({ ...form, supplierBillNumber: event.target.value })} />
        <select value={form.taxMode} onChange={(event) => setForm({ ...form, taxMode: event.target.value })}>
          <option value="CGST_SGST">CGST + SGST</option>
          <option value="IGST">IGST</option>
        </select>
        <input placeholder="Quantity" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        <input placeholder="Unit cost" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} />
        <input placeholder="Narration" value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Post</Button>
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
      <h2>Create Sales Quotation</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}>
          <option value="">Customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
        <select
          value={form.productVariantId}
          onChange={(event) => setForm({
            ...form,
            productVariantId: event.target.value,
            unitPrice: priceForVariant(variants, event.target.value),
          })}
        >
          <option value="">Product variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select>
        <input type="date" value={form.quotationDate} onChange={(event) => setForm({ ...form, quotationDate: event.target.value })} />
        <input type="date" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} />
        <input placeholder="Quantity" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        <input placeholder="Unit price" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} />
        <input placeholder="Discount amount" value={form.discountAmount} onChange={(event) => setForm({ ...form, discountAmount: event.target.value })} />
        <input placeholder="Narration" value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Create</Button>
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
      <h2>Create Sales Order</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value, quotationId: "" })}>
          <option value="">Customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
        <select
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
        </select>
        <select
          value={form.productVariantId}
          onChange={(event) => setForm({
            ...form,
            productVariantId: event.target.value,
            unitPrice: priceForVariant(variants, event.target.value),
          })}
        >
          <option value="">Product variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select>
        <input type="date" value={form.orderDate} onChange={(event) => setForm({ ...form, orderDate: event.target.value })} />
        <input type="date" value={form.expectedDate} onChange={(event) => setForm({ ...form, expectedDate: event.target.value })} />
        <input placeholder="Quantity" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        <input placeholder="Unit price" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} />
        <input placeholder="Discount amount" value={form.discountAmount} onChange={(event) => setForm({ ...form, discountAmount: event.target.value })} />
        <input placeholder="Narration" value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Create</Button>
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
      <h2>Create Delivery Challan</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value, salesOrderId: "" })}>
          <option value="">Customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
        <select
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
        </select>
        <select value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}>
          <option value="">Warehouse</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select>
        <select value={form.productVariantId} onChange={(event) => setForm({ ...form, productVariantId: event.target.value })}>
          <option value="">Product variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select>
        <input type="date" value={form.challanDate} onChange={(event) => setForm({ ...form, challanDate: event.target.value })} />
        <input placeholder="Quantity" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        <input placeholder="Narration" value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Create</Button>
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
  customers,
  deliveryChallans,
  invoices,
  orders,
  variants,
  warehouses,
}: {
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
      <h2>Post Sales Invoice</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value, salesOrderId: "", deliveryChallanId: "" })}>
          <option value="">Customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
        <select value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value, deliveryChallanId: "" })}>
          <option value="">Warehouse</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select>
        <select
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
        </select>
        <select
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
        </select>
        <select
          value={form.productVariantId}
          onChange={(event) => setForm({
            ...form,
            productVariantId: event.target.value,
            unitPrice: priceForVariant(variants, event.target.value),
          })}
        >
          <option value="">Product variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select>
        <input type="date" value={form.invoiceDate} onChange={(event) => setForm({ ...form, invoiceDate: event.target.value })} />
        <select value={form.taxMode} onChange={(event) => setForm({ ...form, taxMode: event.target.value })}>
          <option value="CGST_SGST">CGST + SGST</option>
          <option value="IGST">IGST</option>
        </select>
        <input placeholder="Quantity" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        <input placeholder="Unit price" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} />
        <input placeholder="Discount amount" value={form.discountAmount} onChange={(event) => setForm({ ...form, discountAmount: event.target.value })} />
        <input placeholder="Narration" value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Post</Button>
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
      />
    </article>
  );
}

function InvoiceActionList({
  items,
  onCancel,
}: {
  items: Array<{ id: string; label: string; meta: string; status: string }>;
  onCancel: (id: string) => void;
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
          {item.status === "POSTED" ? (
            <Button type="button" variant="outline" onClick={() => onCancel(item.id)}>
              Cancel
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
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
      <h2>Post Payment</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <select value={form.partyType} onChange={(event) => setForm({ ...form, partyType: event.target.value, partyId: "", allocationDocumentNumber: "", allocationAmount: "" })}>
          <option value="CUSTOMER">Customer receipt</option>
          <option value="SUPPLIER">Supplier payment</option>
        </select>
        <select value={form.partyId} onChange={(event) => setForm({ ...form, partyId: event.target.value, allocationDocumentNumber: "", allocationAmount: "" })}>
          <option value="">{form.partyType === "CUSTOMER" ? "Customer" : "Supplier"}</option>
          {parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}
        </select>
        <select value={form.paymentModeId} onChange={(event) => setForm({ ...form, paymentModeId: event.target.value })}>
          <option value="">Payment mode</option>
          {paymentModes.map((mode) => <option key={mode.id} value={mode.id}>{mode.name}</option>)}
        </select>
        <input type="date" value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} />
        <input placeholder="Amount" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
        <input placeholder="Reference no." value={form.referenceNo} onChange={(event) => setForm({ ...form, referenceNo: event.target.value })} />
        <input placeholder="Narration" value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} />
        <select
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
        </select>
        <input placeholder="Allocation amount" value={form.allocationAmount} onChange={(event) => setForm({ ...form, allocationAmount: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Post</Button>
      </form>
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
  customers,
  employees,
  items,
  taxRates,
  variants,
  vehicles,
  warehouses,
}: {
  customers: Customer[];
  employees: Employee[];
  items: JobCard[];
  taxRates: TaxRate[];
  variants: ProductVariant[];
  vehicles: Vehicle[];
  warehouses: Warehouse[];
}) {
  const [form, setForm] = useState({
    customerId: "",
    vehicleId: "",
    advisorEmployeeId: "",
    technicianEmployeeId: "",
    jobDate: new Date().toISOString().slice(0, 10),
    odometerReading: "0",
    fuelLevel: "",
    complaint: "",
    diagnosis: "",
    workNotes: "",
    inspectionNotes: "",
    deliveryNotes: "",
    technicianStatus: "ASSIGNED",
    technicianNotes: "",
    partVariantId: "",
    partQuantity: "1",
    partRate: "0",
    laborDescription: "",
    laborAmount: "0",
    issueWarehouseId: "",
    billingTaxMode: "CGST_SGST",
    serviceTaxRateId: "",
  });
  const customerVehicles = vehicles.filter((vehicle) => !form.customerId || vehicle.customer?.id === form.customerId);
  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/workshop/job-cards", {
        customerId: form.customerId,
        vehicleId: form.vehicleId,
        advisorEmployeeId: form.advisorEmployeeId,
        technicianEmployeeId: form.technicianEmployeeId,
        jobDate: form.jobDate,
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
          { label: "Complaint verified", checked: true },
          { label: "Road test completed", checked: true },
          { label: "Final quality check completed", checked: true },
        ],
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["job-cards"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]);
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
    },
  });
  const issueMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/workshop/job-cards/${id}/issue-parts`, { warehouseId: form.issueWarehouseId });
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
        billingDate: new Date().toISOString().slice(0, 10),
        taxMode: form.billingTaxMode,
        serviceTaxRateId: form.serviceTaxRateId,
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
      <h2>Create Job Card</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        createMutation.mutate();
      }}>
        <select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value, vehicleId: "" })}>
          <option value="">Customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
        <select value={form.vehicleId} onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}>
          <option value="">Vehicle</option>
          {customerVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber}</option>)}
        </select>
        <select value={form.advisorEmployeeId} onChange={(event) => setForm({ ...form, advisorEmployeeId: event.target.value })}>
          <option value="">Advisor</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
        </select>
        <select value={form.technicianEmployeeId} onChange={(event) => setForm({ ...form, technicianEmployeeId: event.target.value })}>
          <option value="">Technician</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
        </select>
        <input type="date" value={form.jobDate} onChange={(event) => setForm({ ...form, jobDate: event.target.value })} />
        <input placeholder="Odometer" value={form.odometerReading} onChange={(event) => setForm({ ...form, odometerReading: event.target.value })} />
        <input placeholder="Fuel level" value={form.fuelLevel} onChange={(event) => setForm({ ...form, fuelLevel: event.target.value })} />
        <input placeholder="Complaint" value={form.complaint} onChange={(event) => setForm({ ...form, complaint: event.target.value })} />
        <input placeholder="Diagnosis" value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} />
        <input placeholder="Work notes" value={form.workNotes} onChange={(event) => setForm({ ...form, workNotes: event.target.value })} />
        <input placeholder="Inspection notes" value={form.inspectionNotes} onChange={(event) => setForm({ ...form, inspectionNotes: event.target.value })} />
        <input placeholder="Delivery notes" value={form.deliveryNotes} onChange={(event) => setForm({ ...form, deliveryNotes: event.target.value })} />
        <select value={form.technicianStatus} onChange={(event) => setForm({ ...form, technicianStatus: event.target.value })}>
          <option value="ASSIGNED">Assigned</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="ON_HOLD">On hold</option>
          <option value="PENDING">Pending</option>
        </select>
        <input placeholder="Technician notes" value={form.technicianNotes} onChange={(event) => setForm({ ...form, technicianNotes: event.target.value })} />
        <select value={form.partVariantId} onChange={(event) => setForm({ ...form, partVariantId: event.target.value })}>
          <option value="">Estimated part</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select>
        <input placeholder="Part qty" value={form.partQuantity} onChange={(event) => setForm({ ...form, partQuantity: event.target.value })} />
        <input placeholder="Part rate" value={form.partRate} onChange={(event) => setForm({ ...form, partRate: event.target.value })} />
        <input placeholder="Labor" value={form.laborDescription} onChange={(event) => setForm({ ...form, laborDescription: event.target.value })} />
        <input placeholder="Labor amount" value={form.laborAmount} onChange={(event) => setForm({ ...form, laborAmount: event.target.value })} />
        <select value={form.issueWarehouseId} onChange={(event) => setForm({ ...form, issueWarehouseId: event.target.value })}>
          <option value="">Issue warehouse</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select>
        <select value={form.billingTaxMode} onChange={(event) => setForm({ ...form, billingTaxMode: event.target.value })}>
          <option value="CGST_SGST">CGST + SGST</option>
          <option value="IGST">IGST</option>
        </select>
        <select value={form.serviceTaxRateId} onChange={(event) => setForm({ ...form, serviceTaxRateId: event.target.value })}>
          <option value="">Service tax rate</option>
          {taxRates.map((taxRate) => <option key={taxRate.id} value={taxRate.id}>{taxRate.name}</option>)}
        </select>
        <Button type="submit" variant="outline" disabled={createMutation.isPending}>Create</Button>
      </form>
      <JobCardList
        canIssueParts={Boolean(form.issueWarehouseId)}
        items={items}
        onInspect={(id) => inspectionMutation.mutate(id)}
        onBill={(id) => billingMutation.mutate(id)}
        onIssueParts={(id) => issueMutation.mutate(id)}
        onTechnicianUpdate={(id) => technicianMutation.mutate(id)}
        onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
      />
    </article>
  );
}

function JobCardList({
  canIssueParts,
  items,
  onInspect,
  onIssueParts,
  onBill,
  onTechnicianUpdate,
  onStatusChange,
}: {
  canIssueParts: boolean;
  items: JobCard[];
  onInspect: (id: string) => void;
  onBill: (id: string) => void;
  onIssueParts: (id: string) => void;
  onTechnicianUpdate: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  if (items.length === 0) {
    return <p className="empty-text">No records yet.</p>;
  }

  return (
    <ul className="compact-list action-list">
      {items.slice(0, 8).map((item) => (
        <li key={item.id}>
          <span>{`${item.jobCardNumber} / ${item.vehicle.registrationNumber}`}</span>
          <strong>{`${item.customer.name} / ${item.status} / Tech ${item.technicianStatus ?? "PENDING"} / ${item.qualityCheckedAt ? "QC done" : "QC pending"} / ${item.billingNumber ?? "Unbilled"} / Total ${item.billingAmount ?? item.estimatedTotal}`}</strong>
          <select value={item.status} onChange={(event) => onStatusChange(item.id, event.target.value)}>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="READY">READY</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          {!item.partsIssuedAt && !["CANCELLED", "DELIVERED"].includes(item.status) ? (
            <Button type="button" variant="outline" disabled={!canIssueParts} onClick={() => onIssueParts(item.id)}>
              Issue Parts
            </Button>
          ) : null}
          {!item.qualityCheckedAt && !["CANCELLED", "DELIVERED"].includes(item.status) ? (
            <Button type="button" variant="outline" onClick={() => onInspect(item.id)}>
              Inspect
            </Button>
          ) : null}
          {!["CANCELLED", "DELIVERED"].includes(item.status) ? (
            <Button type="button" variant="outline" onClick={() => onTechnicianUpdate(item.id)}>
              Tech Update
            </Button>
          ) : null}
          {!item.billedAt && !["CANCELLED"].includes(item.status) ? (
            <Button type="button" variant="outline" onClick={() => onBill(item.id)}>
              Bill
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ServiceHistoryPanel({ items }: { items: JobCard[] }) {
  return (
    <article className="setup-panel master-panel">
      <h2>Service History</h2>
      <MasterList
        items={items.map((jobCard) => ({
          id: jobCard.id,
          label: `${jobCard.vehicle.registrationNumber} / ${jobCard.jobCardNumber}`,
          meta: `${jobCard.customer.name} / ${jobCard.billingNumber ?? "Unbilled"} / ${jobCard.deliveredAt?.slice(0, 10) ?? jobCard.billedAt?.slice(0, 10) ?? jobCard.jobDate.slice(0, 10)} / Tech ${jobCard.technician?.name ?? jobCard.technicianStatus ?? "Pending"} / Total ${jobCard.billingAmount ?? jobCard.estimatedTotal}`,
        }))}
      />
    </article>
  );
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
        <Button type="button" variant="outline" onClick={() => downloadCsv("/masters/products/export.csv")}>Export CSV</Button>
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
        <Button type="button" variant="outline" onClick={() => downloadCsv("/masters/product-variants/export.csv")}>Export CSV</Button>
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
      <input
        className="list-search"
        placeholder="Search records"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {visibleItems.length === 0 ? <p className="empty-text">No matching records.</p> : null}
      <ul className="compact-list">
        {visibleItems.slice(0, 8).map((item) => (
          <li key={item.id}>
            <span>{item.label}</span>
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
    <article className="setup-panel">
      <h2>Financial Years</h2>
      <form className="inline-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
        <input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Add</Button>
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
    <article className="setup-panel">
      <div className="panel-title-row">
        <h2>Number Series</h2>
        <Button type="button" variant="outline" disabled={seedMutation.isPending} onClick={() => seedMutation.mutate()}>
          Seed Defaults
        </Button>
      </div>
      <form className="inline-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <input value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value })} />
        <input value={form.prefix} onChange={(event) => setForm({ ...form, prefix: event.target.value })} />
        <input value={form.suffix} onChange={(event) => setForm({ ...form, suffix: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Add</Button>
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
