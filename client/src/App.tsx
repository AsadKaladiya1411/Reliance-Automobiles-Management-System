import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { api, type ApiEnvelope } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
import "./App.css";

type SystemStatus = {
  service: string;
  companyConfigured: boolean;
  openFinancialYears: number;
  timestamp: string;
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

function DashboardShell() {
  const status = useSystemStatus();

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
          <Button variant="outline">System Setup</Button>
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardShell />
    </QueryClientProvider>
  );
}

export default App;
