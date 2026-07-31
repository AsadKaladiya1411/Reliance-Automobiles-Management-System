export type AppView = "dashboard" | "masters" | "inventory" | "workshop" | "transactions" | "reports" | "settings";

export type NavigationUser = {
  roles: string[];
  permissions: string[];
};

export const navItems: Array<{ id: AppView; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "DB" },
  { id: "masters", label: "Masters", icon: "MS" },
  { id: "inventory", label: "Inventory", icon: "IN" },
  { id: "workshop", label: "Workshop", icon: "WS" },
  { id: "transactions", label: "Transactions", icon: "TR" },
  { id: "reports", label: "Reports", icon: "RP" },
  { id: "settings", label: "Settings", icon: "ST" },
];

export const viewPermissions: Record<AppView, string[]> = {
  dashboard: ["dashboard:read"],
  masters: ["masters:read"],
  inventory: ["inventory:read"],
  workshop: ["workshop:read"],
  transactions: ["purchase:read", "sales:read", "accounting:read"],
  reports: ["reports:read", "accounting:read", "gst:read"],
  settings: ["settings:read", "company:read"],
};

export function canAccessView(user: NavigationUser, view: AppView) {
  if (user.roles.includes("SUPER_ADMIN")) {
    return true;
  }

  return viewPermissions[view].some((permission) => user.permissions.includes(permission));
}
