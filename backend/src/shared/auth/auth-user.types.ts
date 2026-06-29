import type { AppRole } from "./permissions.constants";

export interface JwtPayload {
  sub: string;
  name: string;
  appRole?: AppRole;
  role: string;
  roleId?: number;
}

export interface AuthenticatedRequestUser extends JwtPayload {
  permissions: {
    menus: string[];
    actions: string[];
  };
}
