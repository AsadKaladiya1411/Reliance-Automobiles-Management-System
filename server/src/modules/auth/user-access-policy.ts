type SuperAdminRoleChange = {
  currentlySuperAdmin: boolean;
  nextRoleCodes: string[];
  otherActiveSuperAdminCount: number;
};

export function removesLastSuperAdmin(change: SuperAdminRoleChange) {
  return change.currentlySuperAdmin
    && !change.nextRoleCodes.includes("SUPER_ADMIN")
    && change.otherActiveSuperAdminCount === 0;
}
