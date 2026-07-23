export type AuthUser = {
  id: string;
  companyId: string;
  username: string;
  fullName: string;
  roles: string[];
  permissions: string[];
};
