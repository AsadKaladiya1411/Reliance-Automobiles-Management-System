import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { api, type ApiEnvelope } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
import "./App.css";

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
  postedInvoices: number;
  taxableAmount: string | number;
  totalTaxAmount: string | number;
  grandTotal: string | number;
};

type SalesSummary = {
  postedInvoices: number;
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

type Unit = {
  id: string;
  code: string;
  name: string;
  symbol: string;
};

type HsnCode = {
  id: string;
  code: string;
  description: string;
};

type TaxRate = {
  id: string;
  name: string;
  cgstRate: string | number;
  sgstRate: string | number;
  igstRate: string | number;
};

type Brand = {
  id: string;
  code: string;
  name: string;
};

type Category = {
  id: string;
  code: string;
  name: string;
};

type Product = {
  id: string;
  code: string;
  name: string;
};

type ProductVariant = {
  id: string;
  code: string;
  name: string;
  salePrice: string | number;
};

type Warehouse = {
  id: string;
  code: string;
  name: string;
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

type Customer = {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  customerType: string;
};

type Supplier = {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  supplierType: string;
};

type Employee = {
  id: string;
  code: string;
  name: string;
  designation?: string | null;
};

type Vehicle = {
  id: string;
  registrationNumber: string;
  brand: string;
  model: string;
  customer?: Customer | null;
};

type PaymentMode = {
  id: string;
  code: string;
  name: string;
  paymentType: string;
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
};

type PurchaseInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: string | number;
  status: string;
  supplier: Supplier;
  warehouse: Warehouse;
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
  lines: Array<{ id: string; productVariant: ProductVariant; quantity: string | number }>;
};

type JobCard = {
  id: string;
  jobCardNumber: string;
  jobDate: string;
  status: string;
  complaint: string;
  estimatedTotal: string | number;
  customer: Customer;
  vehicle: Vehicle;
};

type AppView = "dashboard" | "masters" | "inventory" | "workshop" | "transactions" | "settings";

const navItems: Array<{ id: AppView; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "DB" },
  { id: "masters", label: "Masters", icon: "MS" },
  { id: "inventory", label: "Inventory", icon: "IN" },
  { id: "workshop", label: "Workshop", icon: "WS" },
  { id: "transactions", label: "Transactions", icon: "TR" },
  { id: "settings", label: "Settings", icon: "ST" },
];

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

function useCompany() {
  return useQuery({
    queryKey: ["company"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<Company>>("/company");
      return response.data.data;
    },
  });
}

function useFinancialYears() {
  return useQuery({
    queryKey: ["financial-years"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<FinancialYear[]>>("/financial-years");
      return response.data.data;
    },
  });
}

function useNumberSeries() {
  return useQuery({
    queryKey: ["number-series"],
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

function usePaymentSummary() {
  return useQuery({
    queryKey: ["payment-summary"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<PaymentSummary>>("/payments/summary");
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

function LoginForm() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/auth/login", form);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
    onError: () => {
      setError("Invalid username or password.");
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
  const status = useSystemStatus();
  const company = useCompany();
  const financialYears = useFinancialYears();
  const numberSeries = useNumberSeries();
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
          {navItems.map((item) => (
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

        {activeView === "settings" ? (
          <SettingsView
            company={company.data}
            financialYears={financialYears.data ?? []}
            numberSeries={numberSeries.data ?? []}
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
  const jobCards = useMasterList<JobCard>("job-cards", "/workshop/job-cards");

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
          variants={variants.data ?? []}
          vehicles={vehicles.data ?? []}
        />
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
  const suppliers = useMasterList<Supplier>("suppliers", "/commercial-masters/suppliers");
  const variants = useMasterList<ProductVariant>("product-variants", "/masters/product-variants");
  const warehouses = useMasterList<Warehouse>("warehouses", "/masters/warehouses");
  const purchaseInvoices = useMasterList<PurchaseInvoice>("purchase-invoices", "/purchase/invoices");
  const customers = useMasterList<Customer>("customers", "/commercial-masters/customers");
  const salesInvoices = useMasterList<SalesInvoice>("sales-invoices", "/sales/invoices");
  const partyLedger = useMasterList<PartyLedgerEntry>("party-ledger", "/accounting/party-ledger");
  const paymentModes = useMasterList<PaymentMode>("payment-modes", "/commercial-masters/payment-modes");
  const payments = useMasterList<Payment>("payments", "/payments");

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
        <PurchaseInvoicePanel
          invoices={purchaseInvoices.data ?? []}
          suppliers={suppliers.data ?? []}
          variants={variants.data ?? []}
          warehouses={warehouses.data ?? []}
        />
        <SalesInvoicePanel
          customers={customers.data ?? []}
          invoices={salesInvoices.data ?? []}
          variants={variants.data ?? []}
          warehouses={warehouses.data ?? []}
        />
        <AccountPanel items={accounts.data ?? []} />
        <JournalPanel accounts={accounts.data ?? []} items={journalEntries.data ?? []} />
        <PaymentPanel
          customers={customers.data ?? []}
          items={payments.data ?? []}
          paymentModes={paymentModes.data ?? []}
          suppliers={suppliers.data ?? []}
        />
        <PartyLedgerPanel items={partyLedger.data ?? []} />
      </section>
      <ModuleGrid filter={["Purchase", "Sales", "Workshop", "Accounting"]} />
    </>
  );
}

function SettingsView({
  company,
  financialYears,
  numberSeries,
}: {
  company?: Company;
  financialYears: FinancialYear[];
  numberSeries: NumberSeries[];
}) {
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
      </section>
    </>
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
      <ReadinessMetric label="Posted Invoices" value={purchaseSummary?.postedInvoices} />
      <ReadinessMetric label="Taxable Purchase" value={purchaseSummary?.taxableAmount} />
      <ReadinessMetric label="GST Input" value={purchaseSummary?.totalTaxAmount} />
      <ReadinessMetric label="Grand Total" value={purchaseSummary?.grandTotal} />
    </div>
  );
}

function SalesReadinessGrid({ salesSummary }: { salesSummary?: SalesSummary }) {
  return (
    <div className="readiness-grid">
      <ReadinessMetric label="Posted Invoices" value={salesSummary?.postedInvoices} />
      <ReadinessMetric label="Taxable Sales" value={salesSummary?.taxableAmount} />
      <ReadinessMetric label="GST Output" value={salesSummary?.totalTaxAmount} />
      <ReadinessMetric label="Grand Total" value={salesSummary?.grandTotal} />
      <ReadinessMetric label="COGS" value={salesSummary?.costOfGoodsSold} />
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

function SimpleCodeNamePanel({
  items,
  path,
  queryKeys,
  title,
}: {
  items: Array<{ id: string; code: string; name: string }>;
  path: string;
  queryKeys: string[];
  title: string;
}) {
  const [form, setForm] = useState({ code: "", name: "" });
  const mutation = useCreateMaster(path, queryKeys, () => setForm({ code: "", name: "" }));

  return (
    <article className="setup-panel master-panel">
      <h2>{title}</h2>
      <form
        className="compact-form"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(form);
        }}
      >
        <input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Add</Button>
      </form>
      <MasterList items={items.map((item) => ({ id: item.id, label: item.name, meta: item.code }))} />
    </article>
  );
}

function CustomerPanel({ items }: { items: Customer[] }) {
  const [form, setForm] = useState({ code: "", name: "", customerType: "Retail", phone: "", gstin: "" });
  const mutation = useCreateMaster("/commercial-masters/customers", ["customers", "commercial-master-summary"], () =>
    setForm({ code: "", name: "", customerType: "Retail", phone: "", gstin: "" }),
  );

  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Customers</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(form);
      }}>
        <input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="Type" value={form.customerType} onChange={(event) => setForm({ ...form, customerType: event.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <input placeholder="GSTIN" value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Add</Button>
      </form>
      <MasterList items={items.map((item) => ({ id: item.id, label: item.name, meta: `${item.code} / ${item.customerType}` }))} />
    </article>
  );
}

function SupplierPanel({ items }: { items: Supplier[] }) {
  const [form, setForm] = useState({ code: "", name: "", supplierType: "Distributor", phone: "", gstin: "" });
  const mutation = useCreateMaster("/commercial-masters/suppliers", ["suppliers", "commercial-master-summary"], () =>
    setForm({ code: "", name: "", supplierType: "Distributor", phone: "", gstin: "" }),
  );

  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Suppliers</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(form);
      }}>
        <input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="Type" value={form.supplierType} onChange={(event) => setForm({ ...form, supplierType: event.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <input placeholder="GSTIN" value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Add</Button>
      </form>
      <MasterList items={items.map((item) => ({ id: item.id, label: item.name, meta: `${item.code} / ${item.supplierType}` }))} />
    </article>
  );
}

function EmployeePanel({ items }: { items: Employee[] }) {
  const [form, setForm] = useState({ code: "", name: "", designation: "", department: "", phone: "" });
  const mutation = useCreateMaster("/commercial-masters/employees", ["employees", "commercial-master-summary"], () =>
    setForm({ code: "", name: "", designation: "", department: "", phone: "" }),
  );

  return (
    <article className="setup-panel master-panel">
      <h2>Employees</h2>
      <form className="compact-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(form);
      }}>
        <input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="Designation" value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} />
        <input placeholder="Department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Add</Button>
      </form>
      <MasterList items={items.map((item) => ({ id: item.id, label: item.name, meta: item.designation ?? item.code }))} />
    </article>
  );
}

function PaymentModePanel({ items }: { items: PaymentMode[] }) {
  const [form, setForm] = useState({ code: "", name: "", paymentType: "Cash", requiresReference: false });
  const mutation = useCreateMaster("/commercial-masters/payment-modes", ["payment-modes", "commercial-master-summary"], () =>
    setForm({ code: "", name: "", paymentType: "Cash", requiresReference: false }),
  );

  return (
    <article className="setup-panel master-panel">
      <h2>Payment Modes</h2>
      <form className="compact-form" onSubmit={(event) => {
        event.preventDefault();
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
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Add</Button>
      </form>
      <MasterList items={items.map((item) => ({ id: item.id, label: item.name, meta: item.paymentType }))} />
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
  const mutation = useCreateMaster("/commercial-masters/vehicles", ["vehicles", "commercial-master-summary"], () =>
    setForm({ ...form, registrationNumber: "", brand: "", model: "", fuelType: "" }),
  );

  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Vehicles</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
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
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Add</Button>
      </form>
      <MasterList
        items={items.map((item) => ({
          id: item.id,
          label: item.registrationNumber,
          meta: `${item.brand} ${item.model}${item.customer ? ` / ${item.customer.name}` : ""}`,
        }))}
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

function PurchaseInvoicePanel({
  invoices,
  suppliers,
  variants,
  warehouses,
}: {
  invoices: PurchaseInvoice[];
  suppliers: Supplier[];
  variants: ProductVariant[];
  warehouses: Warehouse[];
}) {
  const [form, setForm] = useState({
    supplierId: "",
    warehouseId: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    supplierBillNumber: "",
    taxMode: "CGST_SGST",
    productVariantId: "",
    quantity: "1",
    unitCost: "0",
    narration: "Purchase invoice",
  });
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/purchase/invoices", {
        supplierId: form.supplierId,
        warehouseId: form.warehouseId,
        invoiceDate: form.invoiceDate,
        supplierBillNumber: form.supplierBillNumber,
        taxMode: form.taxMode,
        narration: form.narration,
        lines: [
          {
            productVariantId: form.productVariantId,
            quantity: form.quantity,
            unitCost: form.unitCost,
          },
        ],
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
      ]);
      setForm({ ...form, productVariantId: "", quantity: "1", unitCost: "0", supplierBillNumber: "" });
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
        <select value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}>
          <option value="">Supplier</option>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select>
        <select value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}>
          <option value="">Warehouse</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select>
        <select value={form.productVariantId} onChange={(event) => setForm({ ...form, productVariantId: event.target.value })}>
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
      <InvoiceActionList
        items={invoices.map((invoice) => ({
          id: invoice.id,
          label: invoice.invoiceNumber,
          meta: `${invoice.supplier.name} / ${invoice.grandTotal}`,
          status: invoice.status,
        }))}
        onCancel={(invoiceId) => cancelMutation.mutate(invoiceId)}
      />
    </article>
  );
}

function SalesInvoicePanel({
  customers,
  invoices,
  variants,
  warehouses,
}: {
  customers: Customer[];
  invoices: SalesInvoice[];
  variants: ProductVariant[];
  warehouses: Warehouse[];
}) {
  const [form, setForm] = useState({
    customerId: "",
    warehouseId: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    taxMode: "CGST_SGST",
    productVariantId: "",
    quantity: "1",
    unitPrice: "0",
    narration: "Sales invoice",
  });
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/sales/invoices", {
        customerId: form.customerId,
        warehouseId: form.warehouseId,
        invoiceDate: form.invoiceDate,
        taxMode: form.taxMode,
        narration: form.narration,
        lines: [
          {
            productVariantId: form.productVariantId,
            quantity: form.quantity,
            unitPrice: form.unitPrice,
          },
        ],
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
      setForm({ ...form, productVariantId: "", quantity: "1", unitPrice: "0" });
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
        <select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}>
          <option value="">Customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
        <select value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}>
          <option value="">Warehouse</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select>
        <select value={form.productVariantId} onChange={(event) => setForm({ ...form, productVariantId: event.target.value })}>
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
        <input placeholder="Narration" value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Post</Button>
      </form>
      <InvoiceActionList
        items={invoices.map((invoice) => ({
          id: invoice.id,
          label: invoice.invoiceNumber,
          meta: `${invoice.customer.name} / ${invoice.grandTotal}`,
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
  });
  const parties = form.partyType === "CUSTOMER" ? customers : suppliers;
  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/payments", form);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["payment-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["party-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["party-ledger-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
      ]);
      setForm({ ...form, partyId: "", amount: "0", referenceNo: "" });
    },
  });

  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Post Payment</h2>
      <form className="compact-form product-form" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <select value={form.partyType} onChange={(event) => setForm({ ...form, partyType: event.target.value, partyId: "" })}>
          <option value="CUSTOMER">Customer receipt</option>
          <option value="SUPPLIER">Supplier payment</option>
        </select>
        <select value={form.partyId} onChange={(event) => setForm({ ...form, partyId: event.target.value })}>
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
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Post</Button>
      </form>
      <MasterList
        items={items.map((payment) => ({
          id: payment.id,
          label: payment.paymentNumber,
          meta: `${payment.customer?.name ?? payment.supplier?.name ?? payment.partyType} / ${payment.amount}`,
        }))}
      />
    </article>
  );
}

function JobCardPanel({
  customers,
  employees,
  items,
  variants,
  vehicles,
}: {
  customers: Customer[];
  employees: Employee[];
  items: JobCard[];
  variants: ProductVariant[];
  vehicles: Vehicle[];
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
    partVariantId: "",
    partQuantity: "1",
    partRate: "0",
    laborDescription: "",
    laborAmount: "0",
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
      await api.patch(`/workshop/job-cards/${id}/status`, { status });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["job-cards"] }),
        queryClient.invalidateQueries({ queryKey: ["workshop-summary"] }),
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
        <select value={form.partVariantId} onChange={(event) => setForm({ ...form, partVariantId: event.target.value })}>
          <option value="">Estimated part</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{`${variant.code} - ${variant.name}`}</option>)}
        </select>
        <input placeholder="Part qty" value={form.partQuantity} onChange={(event) => setForm({ ...form, partQuantity: event.target.value })} />
        <input placeholder="Part rate" value={form.partRate} onChange={(event) => setForm({ ...form, partRate: event.target.value })} />
        <input placeholder="Labor" value={form.laborDescription} onChange={(event) => setForm({ ...form, laborDescription: event.target.value })} />
        <input placeholder="Labor amount" value={form.laborAmount} onChange={(event) => setForm({ ...form, laborAmount: event.target.value })} />
        <Button type="submit" variant="outline" disabled={createMutation.isPending}>Create</Button>
      </form>
      <JobCardList items={items} onStatusChange={(id, status) => statusMutation.mutate({ id, status })} />
    </article>
  );
}

function JobCardList({
  items,
  onStatusChange,
}: {
  items: JobCard[];
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
          <strong>{`${item.customer.name} / ${item.status} / ${item.estimatedTotal}`}</strong>
          <select value={item.status} onChange={(event) => onStatusChange(item.id, event.target.value)}>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="READY">READY</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </li>
      ))}
    </ul>
  );
}

function UnitMasterPanel({ items }: { items: Unit[] }) {
  const [form, setForm] = useState({ code: "", name: "", symbol: "" });
  const mutation = useCreateMaster("/masters/units", ["units", "master-summary"], () =>
    setForm({ code: "", name: "", symbol: "" }),
  );

  return (
    <article className="setup-panel master-panel">
      <h2>Units</h2>
      <form
        className="compact-form"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(form);
        }}
      >
        <input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="Symbol" value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Add</Button>
      </form>
      <MasterList items={items.map((item) => ({ id: item.id, label: item.name, meta: item.symbol }))} />
    </article>
  );
}

function HsnMasterPanel({ items }: { items: HsnCode[] }) {
  const [form, setForm] = useState({ code: "", description: "" });
  const mutation = useCreateMaster("/masters/hsn-codes", ["hsn-codes", "master-summary"], () =>
    setForm({ code: "", description: "" }),
  );

  return (
    <article className="setup-panel master-panel">
      <h2>HSN Codes</h2>
      <form
        className="compact-form"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(form);
        }}
      >
        <input placeholder="HSN" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Add</Button>
      </form>
      <MasterList items={items.map((item) => ({ id: item.id, label: item.description, meta: item.code }))} />
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
  const mutation = useCreateMaster("/masters/tax-rates", ["tax-rates", "master-summary"], () => undefined);

  return (
    <article className="setup-panel master-panel">
      <h2>Tax Rates</h2>
      <form
        className="compact-form"
        onSubmit={(event) => {
          event.preventDefault();
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
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Add</Button>
      </form>
      <MasterList items={items.map((item) => ({ id: item.id, label: item.name, meta: `${item.igstRate}%` }))} />
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
  const mutation = useCreateMaster("/masters/products", ["products", "master-summary"], () =>
    setForm({ ...form, code: "", name: "", reorderLevel: "0" }),
  );

  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Products</h2>
      <form
        className="compact-form product-form"
        onSubmit={(event) => {
          event.preventDefault();
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
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Add</Button>
      </form>
      <MasterList items={items.map((item) => ({ id: item.id, label: item.name, meta: item.code }))} />
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
  const mutation = useCreateMaster("/masters/product-variants", ["product-variants", "master-summary"], () =>
    setForm({ ...form, code: "", name: "", salePrice: "0", purchasePrice: "0" }),
  );

  return (
    <article className="setup-panel master-panel wide-panel">
      <h2>Product Variants</h2>
      <form
        className="compact-form product-form"
        onSubmit={(event) => {
          event.preventDefault();
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
        <Button type="submit" variant="outline" disabled={mutation.isPending}>Add</Button>
      </form>
      <MasterList items={items.map((item) => ({ id: item.id, label: item.name, meta: `${item.code} / ${item.salePrice}` }))} />
    </article>
  );
}

function MasterList({ items }: { items: Array<{ id: string; label: string; meta: string }> }) {
  if (items.length === 0) {
    return <p className="empty-text">No records yet.</p>;
  }

  return (
    <ul className="compact-list">
      {items.slice(0, 6).map((item) => (
        <li key={item.id}>
          <span>{item.label}</span>
          <strong>{item.meta}</strong>
        </li>
      ))}
    </ul>
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

function AppContent() {
  const setup = useSetupStatus();
  const currentUser = useCurrentUser();

  if (setup.isLoading) {
    return <AuthPanel title="Loading RAMS" subtitle="Checking system setup.">{null}</AuthPanel>;
  }

  if (setup.data?.requiresBootstrap) {
    return <SetupForm />;
  }

  if (!currentUser.data) {
    return <LoginForm />;
  }

  return <DashboardShell user={currentUser.data} />;
}

export default App;
