export type AppRole = "operator" | "weighing_staff" | "supervisor" | "elevated";

export type MenuKey =
  | "dashboard"
  | "formula_weighing_list"
  | "formula_weighing"
  | "production_list"
  | "production_timer"
  | "production_summary"
  | "all_production_list"
  | "admin_console"
  | "cost_dashboard"
  | "fg_master_settings";

export type ActionKey =
  | "jobs.read"
  | "jobs.read_all"
  | "formula_weighing.write"
  | "formula_weighing.verify"
  | "formula_weighing.read_all_jobs"
  | "formula_weighing.settings"
  | "production_timer.read"
  | "production_timer.write"
  | "production_timer.admin_edit"
  | "production_summary.read"
  | "production_summary.write"
  | "production_summary.admin_edit"
  | "production_summary.view_cost"
  | "admin.users.read"
  | "admin.users.write"
  | "admin.cost_dashboard.view"
  | "fg_master.read"
  | "fg_master.write";

export interface ResolvedPermissions {
  menus: MenuKey[];
  actions: ActionKey[];
}

const PRODUCTION_MENUS: MenuKey[] = [
  "production_list",
  "production_timer",
  "production_summary",
];

const OPERATOR_MENUS: MenuKey[] = [
  "dashboard",
  ...PRODUCTION_MENUS,
];

const OPERATOR_ACTIONS: ActionKey[] = [
  "jobs.read",
  "production_timer.read",
  "production_timer.write",
  "production_summary.read",
  "production_summary.write",
];

const WEIGHING_STAFF_MENUS: MenuKey[] = [
  "dashboard",
  "formula_weighing_list",
  "formula_weighing",
  ...PRODUCTION_MENUS,
];

const WEIGHING_STAFF_ACTIONS: ActionKey[] = [
  ...OPERATOR_ACTIONS,
  "formula_weighing.read_all_jobs",
  "formula_weighing.write",
  "formula_weighing.verify",
  "production_summary.view_cost",
];

const ELEVATED_MENUS: MenuKey[] = [
  "dashboard",
  ...WEIGHING_STAFF_MENUS,
  "all_production_list",
  "admin_console",
  "cost_dashboard",
  "fg_master_settings",
];

const ELEVATED_ACTIONS: ActionKey[] = [
  ...WEIGHING_STAFF_ACTIONS,
  "jobs.read_all",
  "formula_weighing.settings",
  "production_timer.admin_edit",
  "production_summary.admin_edit",
  "admin.users.read",
  "admin.users.write",
  "admin.cost_dashboard.view",
  "fg_master.read",
  "fg_master.write",
];

const SUPERVISOR_MENUS: MenuKey[] = [
  "dashboard",
  ...WEIGHING_STAFF_MENUS,
  "all_production_list",
  "admin_console",
  "fg_master_settings",
];

const SUPERVISOR_ACTIONS: ActionKey[] = [
  ...WEIGHING_STAFF_ACTIONS,
  "jobs.read_all",
  "formula_weighing.settings",
  "fg_master.read",
  "fg_master.write",
];

export const ROLE_PERMISSION_MATRIX: Record<AppRole, ResolvedPermissions> = {
  operator: { menus: OPERATOR_MENUS, actions: OPERATOR_ACTIONS },
  weighing_staff: {
    menus: WEIGHING_STAFF_MENUS,
    actions: WEIGHING_STAFF_ACTIONS,
  },
  supervisor: { menus: SUPERVISOR_MENUS, actions: SUPERVISOR_ACTIONS },
  elevated: { menus: ELEVATED_MENUS, actions: ELEVATED_ACTIONS },
};

export const APP_ROLE_OPTIONS: AppRole[] = [
  "operator",
  "weighing_staff",
  "supervisor",
  "elevated",
];

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  operator: "พนักงานผลิต",
  weighing_staff: "พนักงานตวงสูตร",
  supervisor: "หัวหน้างาน",
  elevated: "ผู้ดูแลระบบ",
};

const ROLE_ALIASES: Record<string, AppRole> = {
  operator: "operator",
  staff: "operator",
  employee: "operator",
  worker: "operator",
  viewer: "operator",
  พนักงาน: "operator",
  พนักงานผลิต: "operator",
  weighing_staff: "weighing_staff",
  weigher: "weighing_staff",
  weighing: "weighing_staff",
  ตวงสูตร: "weighing_staff",
  พนักงานตวงสูตร: "weighing_staff",
  supervisor: "supervisor",
  lead: "supervisor",
  หัวหน้า: "supervisor",
  หัวหน้างาน: "supervisor",
  manager: "elevated",
  admin: "elevated",
  administrator: "elevated",
  elevated: "elevated",
  ผู้ดูแล: "elevated",
  ผู้ดูแลระบบ: "elevated",
};

export function isAppRole(value: string): value is AppRole {
  return (
    value === "operator" ||
    value === "weighing_staff" ||
    value === "supervisor" ||
    value === "elevated"
  );
}

export function normalizeRoleName(roleName: string): AppRole {
  const key = roleName.trim().toLowerCase();
  return ROLE_ALIASES[key] ?? "operator";
}

/** Map legacy shared-DB role_name to TimeTracker AppRole. */
export function mapLegacyRoleNameToAppRole(roleName: string): AppRole {
  return normalizeRoleName(roleName);
}

export function getPermissionsForAppRole(appRole: AppRole): ResolvedPermissions {
  return ROLE_PERMISSION_MATRIX[appRole];
}

export function getPermissionsForRole(roleName: string): ResolvedPermissions {
  const appRole = normalizeRoleName(roleName);
  return ROLE_PERMISSION_MATRIX[appRole];
}

export function getAppRoleSummary(appRole: AppRole): {
  appRole: AppRole;
  display_name: string;
  canReadAllJobs: boolean;
  canReadAllWeighingJobs: boolean;
  canAdmin: boolean;
} {
  const permissions = ROLE_PERMISSION_MATRIX[appRole];
  return {
    appRole,
    display_name: APP_ROLE_LABELS[appRole],
    canReadAllJobs: permissions.actions.includes("jobs.read_all"),
    canReadAllWeighingJobs:
      permissions.actions.includes("jobs.read_all") ||
      permissions.actions.includes("formula_weighing.read_all_jobs"),
    canAdmin: permissions.actions.includes("admin.users.write"),
  };
}

export function isMenuKey(value: string): value is MenuKey {
  return (
    value === "dashboard" ||
    value === "formula_weighing_list" ||
    value === "formula_weighing" ||
    value === "production_list" ||
    value === "production_timer" ||
    value === "production_summary" ||
    value === "all_production_list" ||
    value === "admin_console" ||
    value === "cost_dashboard" ||
    value === "fg_master_settings"
  );
}

export function isActionKey(value: string): value is ActionKey {
  return (
    value === "jobs.read" ||
    value === "jobs.read_all" ||
    value === "formula_weighing.write" ||
    value === "formula_weighing.verify" ||
    value === "formula_weighing.read_all_jobs" ||
    value === "formula_weighing.settings" ||
    value === "production_timer.read" ||
    value === "production_timer.write" ||
    value === "production_timer.admin_edit" ||
    value === "production_summary.read" ||
    value === "production_summary.write" ||
    value === "production_summary.admin_edit" ||
    value === "production_summary.view_cost" ||
    value === "admin.users.read" ||
    value === "admin.users.write" ||
    value === "admin.cost_dashboard.view" ||
    value === "fg_master.read" ||
    value === "fg_master.write"
  );
}
