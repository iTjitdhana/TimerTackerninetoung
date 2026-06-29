import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../shared/prisma/prisma.module";
import { UserResolverService } from "../../shared/services/user-resolver.service";
import { hashPin } from "../../shared/auth/pin-verifier";
import { assertPinPolicy, isWeakPin } from "../../shared/auth/pin-policy";
import {
  APP_ROLE_OPTIONS,
  getAppRoleSummary,
  getPermissionsForAppRole,
  getPermissionsForRole,
  isAppRole,
  mapLegacyRoleNameToAppRole,
  normalizeRoleName,
  type AppRole,
} from "../../shared/auth/permissions.constants";
import {
  getDefaultOrgRoleId,
  isTimetrackerOwnAuthEnabled,
} from "../../shared/auth/timetracker-auth.config";
import { TimetrackerUserRoleService } from "../../shared/auth/timetracker-user-role.service";
import { PermissionService } from "../../shared/auth/permission.service";
import { CreateUserDto, UpdateRoleMenusDto, UpdateUserDto } from "./dto/admin.dto";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userResolver: UserResolverService,
    private readonly timetrackerUserRoleService: TimetrackerUserRoleService,
    private readonly permissionService: PermissionService,
  ) {}

  getAuthConfig() {
    return { ownAuth: isTimetrackerOwnAuthEnabled() };
  }

  async listUsers() {
    const users = await this.prisma.users.findMany({
      orderBy: [{ is_active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        id_code: true,
        name: true,
        department: true,
        position: true,
        role_id: true,
        is_active: true,
        timetracker_user_roles: isTimetrackerOwnAuthEnabled()
          ? { select: { app_role: true } }
          : false,
      },
    });

    if (isTimetrackerOwnAuthEnabled()) {
      return users.map((user) => this.mapUserWithOwnAuth(user));
    }

    const roles = await this.prisma.role_configurations.findMany({
      select: { id: true, role_name: true, display_name: true },
    });
    const roleMap = new Map(roles.map((role) => [role.id, role]));

    return users.map((user) => ({
      id: user.id,
      idCode: user.id_code,
      name: user.name,
      department: user.department ?? null,
      position: user.position ?? null,
      roleId: user.role_id ?? null,
      roleName: user.role_id
        ? (roleMap.get(user.role_id)?.role_name ?? null)
        : null,
      roleDisplayName: user.role_id
        ? (roleMap.get(user.role_id)?.display_name ?? null)
        : null,
      isActive: user.is_active ?? false,
    }));
  }

  async createUser(dto: CreateUserDto, actorIdCode?: string) {
    const idCode = dto.idCode.trim();
    const name = dto.name.trim();
    const ownAuth = isTimetrackerOwnAuthEnabled();

    if (ownAuth) {
      if (!dto.appRole || !isAppRole(dto.appRole)) {
        throw new BadRequestException("appRole is required when own auth is enabled");
      }
    } else if (dto.roleId == null) {
      throw new BadRequestException("roleId is required");
    }

    if (!ownAuth && dto.roleId != null) {
      const role = await this.prisma.role_configurations.findUnique({
        where: { id: dto.roleId },
      });
      if (!role) {
        throw new BadRequestException(`Role ${dto.roleId} not found`);
      }
    }

    const existing = await this.prisma.users.findFirst({
      where: { id_code: idCode },
    });
    if (existing) {
      throw new ConflictException(`รหัสพนักงาน ${idCode} มีอยู่ในระบบแล้ว`);
    }

    const pinClash = await this.prisma.users.findFirst({
      where: { pin_display: dto.tempPin, is_active: true },
    });
    if (pinClash) {
      throw new ConflictException("PIN ชั่วคราวนี้ถูกใช้แล้ว กรุณาเลือก PIN อื่น");
    }

    assertPinPolicy(dto.tempPin);

    const password = await hashPin(dto.tempPin);
    const newUser = await this.prisma.users.create({
      data: {
        id_code: idCode,
        name,
        password,
        pin_display: dto.tempPin,
        role_id: ownAuth ? getDefaultOrgRoleId() : dto.roleId!,
        is_active: true,
        employee_code: "NEEDS_REGISTER",
      },
    });

    if (ownAuth && dto.appRole) {
      const actorUserId = await this.resolveActorUserId(actorIdCode);
      await this.timetrackerUserRoleService.setAppRoleForUser(
        newUser.id,
        dto.appRole as AppRole,
        actorUserId,
      );
    }

    return this.findUserSummary(newUser.id);
  }

  async updateUser(
    id: number,
    dto: UpdateUserDto,
    actorIdCode?: string,
  ) {
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const ownAuth = isTimetrackerOwnAuthEnabled();

    if (ownAuth) {
      if (dto.roleId !== undefined) {
        throw new ForbiddenException(
          "Cannot change shared users.role_id when TIMETRACKER_OWN_AUTH is enabled",
        );
      }

      if (dto.appRole != null) {
        if (!isAppRole(dto.appRole)) {
          throw new BadRequestException(`Invalid appRole: ${dto.appRole}`);
        }
        const actorUserId = await this.resolveActorUserId(actorIdCode);
        await this.timetrackerUserRoleService.setAppRoleForUser(
          id,
          dto.appRole as AppRole,
          actorUserId,
        );
      }
    } else if (dto.roleId != null) {
      const role = await this.prisma.role_configurations.findUnique({
        where: { id: dto.roleId },
      });
      if (!role) {
        throw new BadRequestException(`Role ${dto.roleId} not found`);
      }
    }

    await this.prisma.users.update({
      where: { id },
      data: {
        ...(dto.roleId !== undefined && !ownAuth ? { role_id: dto.roleId } : {}),
        ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
        updated_at: new Date(),
      },
    });

    return this.findUserSummary(id);
  }

  async listRoles() {
    if (isTimetrackerOwnAuthEnabled()) {
      return APP_ROLE_OPTIONS.map((appRole, index) => ({
        id: index + 1,
        role_name: appRole,
        display_name: getAppRoleSummary(appRole).display_name,
        color: null,
        appRole,
        canReadAllJobs: getAppRoleSummary(appRole).canReadAllJobs,
        canReadAllWeighingJobs: getAppRoleSummary(appRole).canReadAllWeighingJobs,
        canAdmin: getAppRoleSummary(appRole).canAdmin,
      }));
    }

    const roles = await this.prisma.role_configurations.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        role_name: true,
        display_name: true,
        color: true,
      },
    });

    return roles.map((role) => {
      const appRole = normalizeRoleName(role.role_name);
      const permissions = getPermissionsForRole(role.role_name);
      return {
        ...role,
        appRole,
        canReadAllJobs: permissions.actions.includes("jobs.read_all"),
        canReadAllWeighingJobs:
          permissions.actions.includes("jobs.read_all") ||
          permissions.actions.includes("formula_weighing.read_all_jobs"),
        canAdmin: permissions.actions.includes("admin.users.write"),
      };
    });
  }

  async listMenus() {
    if (isTimetrackerOwnAuthEnabled()) {
      return getPermissionsForAppRole("operator").menus.map((menuKey) => ({
        menu_key: menuKey,
        label: menuKey,
        path: `/${menuKey}`,
        menu_group: "timetracker",
      }));
    }

    return this.prisma.menu_catalog.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: "asc" }, { id: "asc" }],
      select: {
        menu_key: true,
        label: true,
        path: true,
        menu_group: true,
      },
    });
  }

  async getRoleMenus(roleId: number) {
    if (isTimetrackerOwnAuthEnabled()) {
      const appRole = this.resolveAppRoleFromListIndex(roleId);
      return this.permissionService.getRoleMenusFromAppRole(appRole);
    }

    await this.assertRoleExists(roleId);
    const rows = await this.prisma.role_menu_permissions.findMany({
      where: { role_id: roleId },
      select: { menu_key: true, can_view: true },
    });
    return rows.map((row) => ({
      menuKey: row.menu_key,
      canView: row.can_view ?? false,
    }));
  }

  async updateRoleMenus(
    roleId: number,
    dto: UpdateRoleMenusDto,
    actorIdCode: string,
  ) {
    if (isTimetrackerOwnAuthEnabled()) {
      throw new ForbiddenException(
        "Shared role_menu_permissions cannot be modified when TIMETRACKER_OWN_AUTH is enabled",
      );
    }

    await this.assertRoleExists(roleId);

    const before = await this.prisma.role_menu_permissions.findMany({
      where: { role_id: roleId },
      select: { menu_key: true, can_view: true },
    });

    for (const item of dto.items) {
      await this.prisma.role_menu_permissions.upsert({
        where: {
          role_id_menu_key: { role_id: roleId, menu_key: item.menuKey },
        },
        create: {
          role_id: roleId,
          menu_key: item.menuKey,
          can_view: item.canView,
        },
        update: { can_view: item.canView },
      });
    }

    const after = await this.prisma.role_menu_permissions.findMany({
      where: { role_id: roleId },
      select: { menu_key: true, can_view: true },
    });

    await this.writeAudit(roleId, actorIdCode, "update_role_menus", before, after);

    return this.getRoleMenus(roleId);
  }

  async resetPin(id: number) {
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const tempPin = await this.generateAvailablePin(id);
    const password = await hashPin(tempPin);

    await this.prisma.users.update({
      where: { id },
      data: {
        pin_display: tempPin,
        password,
        employee_code: "NEEDS_REGISTER",
        updated_at: new Date(),
      },
    });

    return {
      id: user.id,
      idCode: user.id_code,
      name: user.name,
      tempPin,
    };
  }

  private mapUserWithOwnAuth(user: {
    id: number;
    id_code: string;
    name: string;
    department: string | null;
    position: string | null;
    role_id: number | null;
    is_active: boolean | null;
    timetracker_user_roles?: { app_role: string } | null;
  }) {
    const appRoleRaw = user.timetracker_user_roles?.app_role;
    const appRole: AppRole | null =
      appRoleRaw && isAppRole(appRoleRaw) ? appRoleRaw : null;

    return {
      id: user.id,
      idCode: user.id_code,
      name: user.name,
      department: user.department ?? null,
      position: user.position ?? null,
      roleId: user.role_id ?? null,
      roleName: appRole,
      roleDisplayName: appRole
        ? getAppRoleSummary(appRole).display_name
        : null,
      appRole,
      isActive: user.is_active ?? false,
    };
  }

  private resolveAppRoleFromListIndex(roleId: number): AppRole {
    const index = roleId - 1;
    const appRole = APP_ROLE_OPTIONS[index];
    if (!appRole) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }
    return appRole;
  }

  private async findUserSummary(id: number) {
    const user = await this.prisma.users.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        id_code: true,
        name: true,
        department: true,
        position: true,
        role_id: true,
        is_active: true,
        timetracker_user_roles: isTimetrackerOwnAuthEnabled()
          ? { select: { app_role: true } }
          : false,
      },
    });

    if (isTimetrackerOwnAuthEnabled()) {
      return this.mapUserWithOwnAuth(user);
    }

    const role = user.role_id
      ? await this.prisma.role_configurations.findUnique({
          where: { id: user.role_id },
          select: { role_name: true, display_name: true },
        })
      : null;

    return {
      id: user.id,
      idCode: user.id_code,
      name: user.name,
      department: user.department ?? null,
      position: user.position ?? null,
      roleId: user.role_id ?? null,
      roleName: role?.role_name ?? null,
      roleDisplayName: role?.display_name ?? null,
      isActive: user.is_active ?? false,
    };
  }

  private async assertRoleExists(roleId: number) {
    const role = await this.prisma.role_configurations.findUnique({
      where: { id: roleId },
    });
    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }
  }

  private async resolveActorUserId(actorIdCode?: string): Promise<number | null> {
    if (!actorIdCode) {
      return null;
    }
    try {
      return await this.userResolver.resolveUserId(actorIdCode);
    } catch {
      return null;
    }
  }

  private async generateAvailablePin(excludeUserId: number): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = String(Math.floor(1000 + Math.random() * 9000));
      const clash = await this.prisma.users.findFirst({
        where: {
          pin_display: candidate,
          is_active: true,
          NOT: { id: excludeUserId },
        },
        select: { id: true },
      });
      if (!clash && !isWeakPin(candidate)) {
        return candidate;
      }
    }
    throw new BadRequestException(
      "ไม่สามารถสร้าง PIN ชั่วคราวที่ไม่ซ้ำได้ กรุณาลองใหม่",
    );
  }

  private async writeAudit(
    roleId: number,
    actorIdCode: string,
    action: string,
    before: unknown,
    after: unknown,
  ) {
    let actorUserId: number | null = null;
    try {
      actorUserId = await this.userResolver.resolveUserId(actorIdCode);
    } catch {
      actorUserId = null;
    }

    try {
      await this.prisma.role_menu_audits.create({
        data: {
          actor_user_id: actorUserId,
          role_id: roleId,
          action,
          before_data: before as Prisma.InputJsonValue,
          after_data: after as Prisma.InputJsonValue,
        },
      });
    } catch {
      // audit ล้มเหลวไม่ควรทำให้การอัปเดตสิทธิ์ล้มทั้งหมด
    }
  }
}
