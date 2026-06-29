import { afterEach, describe, expect, it, vi } from "vitest";
import { PermissionService } from "./permission.service";
import { mapLegacyRoleNameToAppRole } from "./permissions.constants";

describe("PermissionService own auth", () => {
  afterEach(() => {
    delete process.env.TIMETRACKER_OWN_AUTH;
  });

  it("prefers timetracker DB role over stale JWT appRole", async () => {
    process.env.TIMETRACKER_OWN_AUTH = "true";

    const service = new PermissionService({ isConnected: true } as never, {
      getAppRoleForUser: vi.fn().mockResolvedValue("weighing_staff"),
      ensureAppRoleForUser: vi.fn(),
    } as never);

    const permissions = await service.resolvePermissions({
      userId: 7,
      appRole: "supervisor",
      legacyRoleName: "supervisor",
    });

    expect(permissions.menus).toContain("formula_weighing_list");
    expect(permissions.menus).toContain("dashboard");
    expect(permissions.actions).toContain("formula_weighing.read_all_jobs");
    expect(permissions.actions).not.toContain("jobs.read_all");
  });

  it("uses timetracker app role and ignores shared menu permissions", async () => {
    process.env.TIMETRACKER_OWN_AUTH = "true";

    const findMany = vi.fn();
    const prisma = {
      isConnected: true,
      role_menu_permissions: {
        findMany,
      },
    };

    const timetrackerUserRoleService = {
      getAppRoleForUser: vi.fn().mockResolvedValue("weighing_staff"),
      ensureAppRoleForUser: vi.fn(),
    } as never;

    const service = new PermissionService(prisma as never, timetrackerUserRoleService);
    const permissions = await service.resolvePermissions({
      userId: 1,
      legacyRoleId: 99,
      legacyRoleName: "manager",
    });

    expect(permissions.actions).toContain("formula_weighing.write");
    expect(permissions.actions).not.toContain("admin.users.write");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("lazy backfills app role when missing", async () => {
    process.env.TIMETRACKER_OWN_AUTH = "true";

    const ensureAppRoleForUser = vi
      .fn()
      .mockResolvedValue(mapLegacyRoleNameToAppRole("supervisor"));

    const service = new PermissionService({ isConnected: true } as never, {
      getAppRoleForUser: vi.fn().mockResolvedValue(null),
      ensureAppRoleForUser,
    } as never);

    const permissions = await service.resolvePermissions({
      userId: 2,
      legacyRoleName: "supervisor",
    });

    expect(ensureAppRoleForUser).toHaveBeenCalledWith(2, "supervisor");
    expect(permissions.actions).toContain("jobs.read_all");
    expect(permissions.actions).not.toContain("admin.users.write");
  });
});
