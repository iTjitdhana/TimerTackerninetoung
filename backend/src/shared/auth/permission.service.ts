import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.module";
import { isTimetrackerOwnAuthEnabled } from "./timetracker-auth.config";
import {
  getPermissionsForAppRole,
  getPermissionsForRole,
  isActionKey,
  isMenuKey,
  mapLegacyRoleNameToAppRole,
  type ActionKey,
  type AppRole,
  type MenuKey,
  type ResolvedPermissions,
} from "./permissions.constants";
import { TimetrackerUserRoleService } from "./timetracker-user-role.service";

export interface ResolvePermissionsInput {
  userId?: number;
  legacyRoleId?: number | null;
  legacyRoleName?: string;
  appRole?: AppRole;
}

@Injectable()
export class PermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timetrackerUserRoleService: TimetrackerUserRoleService,
  ) {}

  async resolvePermissions(
    input: ResolvePermissionsInput | number | null | undefined,
    legacyRoleName?: string,
  ): Promise<ResolvedPermissions> {
    const normalized = this.normalizeInput(input, legacyRoleName);

    if (isTimetrackerOwnAuthEnabled()) {
      return this.resolveOwnAuthPermissions(normalized);
    }

    return this.resolveLegacyPermissions(normalized);
  }

  /** @deprecated Use resolvePermissions(input object) */
  async resolvePermissionsLegacy(
    roleId: number | null | undefined,
    roleName: string,
  ): Promise<ResolvedPermissions> {
    return this.resolvePermissions({
      legacyRoleId: roleId,
      legacyRoleName: roleName,
    });
  }

  hasAction(permissions: ResolvedPermissions, action: ActionKey): boolean {
    return permissions.actions.includes(action);
  }

  hasAnyAction(
    permissions: ResolvedPermissions,
    actions: ActionKey[],
  ): boolean {
    return actions.some((action) => this.hasAction(permissions, action));
  }

  filterActions(actions: string[]): ActionKey[] {
    return actions.filter(isActionKey);
  }

  getRoleMenusFromAppRole(appRole: AppRole): Array<{ menuKey: MenuKey; canView: boolean }> {
    const permissions = getPermissionsForAppRole(appRole);
    return permissions.menus.map((menuKey) => ({
      menuKey,
      canView: true,
    }));
  }

  private normalizeInput(
    input: ResolvePermissionsInput | number | null | undefined,
    legacyRoleName?: string,
  ): ResolvePermissionsInput {
    if (typeof input === "number" || input == null) {
      return {
        legacyRoleId: input ?? undefined,
        legacyRoleName: legacyRoleName ?? "operator",
      };
    }

    if (typeof input === "object" && "legacyRoleName" in input) {
      return input;
    }

    return input;
  }

  private async resolveOwnAuthPermissions(
    input: ResolvePermissionsInput,
  ): Promise<ResolvedPermissions> {
    let appRole: AppRole | undefined;

    if (input.userId != null) {
      appRole =
        (await this.timetrackerUserRoleService.getAppRoleForUser(input.userId)) ??
        undefined;
    }

    if (!appRole && input.appRole) {
      appRole = input.appRole;
    }

    if (!appRole && input.userId != null) {
      appRole = await this.timetrackerUserRoleService.ensureAppRoleForUser(
        input.userId,
        input.legacyRoleName ?? "operator",
      );
    }

    if (!appRole) {
      appRole = mapLegacyRoleNameToAppRole(input.legacyRoleName ?? "operator");
    }

    return getPermissionsForAppRole(appRole);
  }

  private async resolveLegacyPermissions(
    input: ResolvePermissionsInput,
  ): Promise<ResolvedPermissions> {
    const roleName = input.legacyRoleName ?? "operator";
    const base = getPermissionsForRole(roleName);
    const roleId = input.legacyRoleId;

    if (!this.prisma.isConnected || !roleId) {
      return base;
    }

    const dbPermissions = await this.prisma.role_menu_permissions.findMany({
      where: {
        role_id: roleId,
        can_view: true,
      },
      select: { menu_key: true },
    });

    if (dbPermissions.length === 0) {
      return base;
    }

    const dbMenus = dbPermissions
      .map((row) => row.menu_key)
      .filter(isMenuKey);

    if (dbMenus.length === 0) {
      return base;
    }

    const allowedMenuSet = new Set<MenuKey>(base.menus);
    const menus = dbMenus.filter((menu) => allowedMenuSet.has(menu));

    return {
      menus: menus.length > 0 ? menus : base.menus,
      actions: base.actions,
    };
  }
}
