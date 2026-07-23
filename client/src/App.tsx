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
  const status = useSystemStatus();
  const company = useCompany();
  const financialYears = useFinancialYears();
  const numberSeries = useNumberSeries();
  const masterSummary = useMasterSummary();
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
          <a className="active" href="/">
            <span className="nav-icon">DB</span>
            Dashboard
          </a>
          <a href="/">
            <span className="nav-icon">MS</span>
            Masters
          </a>
          <a href="/">
            <span className="nav-icon">IN</span>
            Inventory
          </a>
          <a href="/">
            <span className="nav-icon">TR</span>
            Transactions
          </a>
          <a href="/">
            <span className="nav-icon">ST</span>
            Settings
          </a>
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

        <section className="foundation-grid" aria-label="Foundation setup">
          <article className="setup-panel">
            <h2>Company Profile</h2>
            <dl>
              <div>
                <dt>Name</dt>
                <dd>{company.data?.name ?? "Loading"}</dd>
              </div>
              <div>
                <dt>GSTIN</dt>
                <dd>{company.data?.gstin ?? "Not configured"}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{[company.data?.city, company.data?.state].filter(Boolean).join(", ") || "Not configured"}</dd>
              </div>
            </dl>
          </article>

          <FinancialYearPanel financialYears={financialYears.data ?? []} />
          <NumberSeriesPanel numberSeries={numberSeries.data ?? []} />
        </section>

        <section className="setup-panel" aria-label="Master data readiness">
          <h2>Master Data Readiness</h2>
          <div className="readiness-grid">
            <ReadinessMetric label="Units" value={masterSummary.data?.units} />
            <ReadinessMetric label="HSN Codes" value={masterSummary.data?.hsnCodes} />
            <ReadinessMetric label="Tax Rates" value={masterSummary.data?.taxRates} />
            <ReadinessMetric label="Brands" value={masterSummary.data?.brands} />
            <ReadinessMetric label="Categories" value={masterSummary.data?.categories} />
            <ReadinessMetric label="Sub-categories" value={masterSummary.data?.subCategories} />
            <ReadinessMetric label="Products" value={masterSummary.data?.products} />
            <ReadinessMetric label="Warehouses" value={masterSummary.data?.warehouses} />
          </div>
        </section>

        <section className="module-grid" aria-label="RAMS modules">
          {modules.map((module) => (
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
      </section>
    </main>
  );
}

function ReadinessMetric({ label, value }: { label: string; value?: number }) {
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
