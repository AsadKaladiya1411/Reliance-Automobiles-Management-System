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

type AppView = "dashboard" | "masters" | "inventory" | "transactions" | "settings";

const navItems: Array<{ id: AppView; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "DB" },
  { id: "masters", label: "Masters", icon: "MS" },
  { id: "inventory", label: "Inventory", icon: "IN" },
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
            inventorySummary={inventorySummary.data}
            masterSummary={masterSummary.data}
            status={status}
          />
        ) : null}

        {activeView === "masters" ? <MastersView masterSummary={masterSummary.data} /> : null}

        {activeView === "inventory" ? (
          <InventoryView inventorySummary={inventorySummary.data} />
        ) : null}

        {activeView === "transactions" ? <TransactionsView /> : null}

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
  status,
  masterSummary,
  inventorySummary,
}: {
  status: ReturnType<typeof useSystemStatus>;
  masterSummary?: MasterSummary;
  inventorySummary?: InventorySummary;
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

      <section className="setup-panel" aria-label="Inventory foundation">
        <h2>Inventory Foundation</h2>
        <InventoryReadinessGrid inventorySummary={inventorySummary} />
      </section>

      <ModuleGrid />
    </>
  );
}

function MastersView({ masterSummary }: { masterSummary?: MasterSummary }) {
  const units = useMasterList<Unit>("units", "/masters/units");
  const hsnCodes = useMasterList<HsnCode>("hsn-codes", "/masters/hsn-codes");
  const taxRates = useMasterList<TaxRate>("tax-rates", "/masters/tax-rates");
  const brands = useMasterList<Brand>("brands", "/masters/brands");
  const categories = useMasterList<Category>("categories", "/masters/categories");
  const products = useMasterList<Product>("products", "/masters/products");
  const variants = useMasterList<ProductVariant>("product-variants", "/masters/product-variants");
  const warehouses = useMasterList<Warehouse>("warehouses", "/masters/warehouses");

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
      <section className="masters-grid">
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
      <ModuleGrid filter={["Inventory"]} />
    </>
  );
}

function TransactionsView() {
  return (
    <>
      <section className="view-header">
        <h2>Transactions</h2>
        <p>Purchase, sales, workshop, accounting, and GST posting workflows will be added here incrementally.</p>
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

  return (
    <article className="setup-panel">
      <h2>Number Series</h2>
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
