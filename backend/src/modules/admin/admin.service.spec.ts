import { afterEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { AdminService } from "./admin.service";
import type { PrismaService } from "../../shared/prisma/prisma.module";
import type { UserResolverService } from "../../shared/services/user-resolver.service";
import type { TimetrackerUserRoleService } from "../../shared/auth/timetracker-user-role.service";
import type { PermissionService } from "../../shared/auth/permission.service";

function createAdminService(
  prismaOverrides: Record<string, unknown>,
  timetrackerOverrides: Record<string, unknown> = {},
) {
  const prisma = {
    isConnected: true,
    ...prismaOverrides,
  } as unknown as PrismaService;
  const userResolver = {
    resolveUserId: vi.fn().mockResolvedValue(99),
  } as unknown as UserResolverService;
  const timetrackerUserRoleService = {
    setAppRoleForUser: vi.fn().mockResolvedValue(undefined),
    getAppRoleForUser: vi.fn().mockResolvedValue(null),
    ...timetrackerOverrides,
  } as unknown as TimetrackerUserRoleService;
  const permissionService = {
    getRoleMenusFromAppRole: vi.fn().mockReturnValue([]),
  } as unknown as PermissionService;

  return new AdminService(
    prisma,
    userResolver,
    timetrackerUserRoleService,
    permissionService,
  );
}

describe("AdminService own auth", () => {
  afterEach(() => {
    delete process.env.TIMETRACKER_OWN_AUTH;
  });

  it("blocks updateRoleMenus when own auth is enabled", async () => {
    process.env.TIMETRACKER_OWN_AUTH = "true";
    const service = createAdminService({});

    await expect(
      service.updateRoleMenus(1, { items: [{ menuKey: "dashboard", canView: true }] }, "admin"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("updates timetracker_user_roles instead of users.role_id", async () => {
    process.env.TIMETRACKER_OWN_AUTH = "true";
    const update = vi.fn().mockResolvedValue({});
    const findUnique = vi.fn().mockResolvedValue({
      id: 7,
      id_code: "u7",
      name: "User 7",
      role_id: 5,
      is_active: true,
    });
    const findUniqueOrThrow = vi.fn().mockResolvedValue({
      id: 7,
      id_code: "u7",
      name: "User 7",
      department: null,
      position: null,
      role_id: 5,
      is_active: true,
      timetracker_user_roles: { app_role: "supervisor" },
    });
    const setAppRoleForUser = vi.fn().mockResolvedValue(undefined);
    const service = createAdminService(
      {
        users: { findUnique, findUniqueOrThrow, update },
      },
      { setAppRoleForUser },
    );

    const result = await service.updateUser(7, { appRole: "supervisor" }, "admin");

    expect(setAppRoleForUser).toHaveBeenCalledWith(7, "supervisor", 99);
    expect(update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.not.objectContaining({ role_id: expect.anything() }),
    });
    expect((result as { appRole?: string }).appRole).toBe("supervisor");
  });
});
