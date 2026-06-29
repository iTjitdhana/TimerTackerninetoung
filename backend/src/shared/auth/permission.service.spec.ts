import { describe, expect, it } from "vitest";
import {
  getPermissionsForRole,
  mapLegacyRoleNameToAppRole,
  normalizeRoleName,
} from "./permissions.constants";
import { PermissionService } from "./permission.service";

describe("normalizeRoleName", () => {
  it("maps staff to operator", () => {
    expect(normalizeRoleName("staff")).toBe("operator");
  });

  it("maps weighing_staff correctly", () => {
    expect(normalizeRoleName("weighing_staff")).toBe("weighing_staff");
  });

  it("maps manager to elevated", () => {
    expect(normalizeRoleName("manager")).toBe("elevated");
  });

  it("maps viewer to operator", () => {
    expect(normalizeRoleName("viewer")).toBe("operator");
  });

  it("maps elevated directly", () => {
    expect(normalizeRoleName("elevated")).toBe("elevated");
  });

  it("mapLegacyRoleNameToAppRole matches normalizeRoleName", () => {
    expect(mapLegacyRoleNameToAppRole("manager")).toBe("elevated");
  });
});

describe("getPermissionsForRole", () => {
  it("operator has production but not formula menus", () => {
    const permissions = getPermissionsForRole("operator");
    expect(permissions.menus).toContain("production_list");
    expect(permissions.menus).not.toContain("formula_weighing_list");
    expect(permissions.actions).not.toContain("formula_weighing.write");
    expect(permissions.actions).not.toContain("production_summary.view_cost");
  });

  it("weighing_staff can view production cost", () => {
    const permissions = getPermissionsForRole("weighing_staff");
    expect(permissions.actions).toContain("production_summary.view_cost");
  });

  it("weighing_staff has formula and production menus only", () => {
    const permissions = getPermissionsForRole("weighing_staff");
    expect(permissions.menus).toContain("formula_weighing_list");
    expect(permissions.menus).toContain("production_list");
    expect(permissions.menus).toContain("dashboard");
    expect(permissions.menus).not.toContain("all_production_list");
    expect(permissions.menus).not.toContain("admin_console");
  });

  it("weighing_staff has formula permissions", () => {
    const permissions = getPermissionsForRole("weighing_staff");
    expect(permissions.menus).toContain("formula_weighing_list");
    expect(permissions.actions).toContain("formula_weighing.write");
    expect(permissions.actions).toContain("formula_weighing.verify");
    expect(permissions.actions).toContain("production_timer.write");
  });

  it("manager has all production menus", () => {
    const permissions = getPermissionsForRole("manager");
    expect(permissions.menus).toContain("all_production_list");
    expect(permissions.actions).toContain("jobs.read_all");
    expect(permissions.actions).toContain("formula_weighing.settings");
    expect(permissions.actions).toContain("production_timer.admin_edit");
    expect(permissions.actions).toContain("production_summary.admin_edit");
  });

  it("operator cannot admin-edit production records", () => {
    const permissions = getPermissionsForRole("operator");
    expect(permissions.actions).not.toContain("production_timer.admin_edit");
    expect(permissions.actions).not.toContain("production_summary.admin_edit");
  });

  it("manager can view cost dashboard", () => {
    const permissions = getPermissionsForRole("manager");
    expect(permissions.menus).toContain("cost_dashboard");
    expect(permissions.actions).toContain("admin.cost_dashboard.view");
  });

  it("supervisor cannot view cost dashboard", () => {
    const permissions = getPermissionsForRole("supervisor");
    expect(permissions.menus).not.toContain("cost_dashboard");
    expect(permissions.actions).not.toContain("admin.cost_dashboard.view");
  });

  it("supervisor keeps dashboard access", () => {
    const permissions = getPermissionsForRole("supervisor");
    expect(permissions.menus).toContain("dashboard");
    expect(permissions.menus).toContain("formula_weighing_list");
  });

  it("supervisor can view all production but not admin-edit", () => {
    const permissions = getPermissionsForRole("supervisor");
    expect(permissions.menus).toContain("all_production_list");
    expect(permissions.actions).toContain("jobs.read_all");
    expect(permissions.actions).not.toContain("production_timer.admin_edit");
    expect(permissions.actions).not.toContain("production_summary.admin_edit");
    expect(permissions.actions).not.toContain("admin.users.write");
  });

  it("weighing_staff can view all weighing jobs but not all production jobs", () => {
    const permissions = getPermissionsForRole("weighing_staff");
    expect(permissions.actions).toContain("formula_weighing.read_all_jobs");
    expect(permissions.actions).not.toContain("jobs.read_all");
  });

  it("operator cannot view all jobs", () => {
    const permissions = getPermissionsForRole("operator");
    expect(permissions.actions).not.toContain("jobs.read_all");
  });

  it("weighing_staff cannot manage formula weighing settings", () => {
    const permissions = getPermissionsForRole("weighing_staff");
    expect(permissions.actions).not.toContain("formula_weighing.settings");
  });
});

describe("PermissionService", () => {
  const timetrackerUserRoleService = {
    getAppRoleForUser: async () => null,
    ensureAppRoleForUser: async (_userId: number, legacyRoleName: string) =>
      mapLegacyRoleNameToAppRole(legacyRoleName),
  } as never;

  const service = new PermissionService(
    { isConnected: false } as never,
    timetrackerUserRoleService,
  );

  it("hasAction returns true for allowed action", () => {
    const permissions = getPermissionsForRole("weighing_staff");
    expect(service.hasAction(permissions, "formula_weighing.verify")).toBe(true);
  });

  it("hasAnyAction returns false when none match", () => {
    const permissions = getPermissionsForRole("operator");
    expect(
      service.hasAnyAction(permissions, ["formula_weighing.write"]),
    ).toBe(false);
  });
});
