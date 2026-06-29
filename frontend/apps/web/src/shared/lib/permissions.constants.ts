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
  | "fg_master_settings"

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
  | "fg_master.write"

export interface UserPermissions {
  menus: MenuKey[]
  actions: ActionKey[]
}

export type AppRole = "operator" | "weighing_staff" | "supervisor" | "elevated"

export interface AuthUser {
  employeeId: string
  name: string
  role: string
  appRole?: AppRole
  roleId?: number
  roleDisplayName?: string
  department?: string
  position?: string
  email?: string
  phone?: string
  avatarUrl?: string
}

export interface AuthSession {
  token: string
  user: AuthUser
  permissions: UserPermissions
  canChangePin?: boolean
  needsRegistration?: boolean
}

export interface AuthSessionData {
  user: AuthUser
  permissions: UserPermissions
  canChangePin: boolean
  needsRegistration?: boolean
}

const PRODUCTION_MENUS: MenuKey[] = [
  "production_list",
  "production_timer",
  "production_summary",
]

const OPERATOR_MENUS: MenuKey[] = [
  "dashboard",
  ...PRODUCTION_MENUS,
]

const OPERATOR_ACTIONS: ActionKey[] = [
  "jobs.read",
  "production_timer.read",
  "production_timer.write",
  "production_summary.read",
  "production_summary.write",
]

const WEIGHING_STAFF_MENUS: MenuKey[] = [
  "dashboard",
  "formula_weighing_list",
  "formula_weighing",
  ...PRODUCTION_MENUS,
]

const WEIGHING_STAFF_ACTIONS: ActionKey[] = [
  ...OPERATOR_ACTIONS,
  "formula_weighing.read_all_jobs",
  "formula_weighing.write",
  "formula_weighing.verify",
  "production_summary.view_cost",
]

const ELEVATED_MENUS: MenuKey[] = [
  "dashboard",
  ...WEIGHING_STAFF_MENUS,
  "all_production_list",
  "admin_console",
  "cost_dashboard",
  "fg_master_settings",
]

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
]

const SUPERVISOR_MENUS: MenuKey[] = [
  "dashboard",
  ...WEIGHING_STAFF_MENUS,
  "all_production_list",
  "admin_console",
  "fg_master_settings",
]

const SUPERVISOR_ACTIONS: ActionKey[] = [
  ...WEIGHING_STAFF_ACTIONS,
  "jobs.read_all",
  "formula_weighing.settings",
  "fg_master.read",
  "fg_master.write",
]

export const APP_ROLE_OPTIONS: AppRole[] = [
  "operator",
  "weighing_staff",
  "supervisor",
  "elevated",
]

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  operator: "พนักงานผลิต",
  weighing_staff: "พนักงานตวงสูตร",
  supervisor: "หัวหน้างาน",
  elevated: "ผู้ดูแลระบบ",
}

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
}

const ROLE_PERMISSIONS: Record<AppRole, UserPermissions> = {
  operator: { menus: OPERATOR_MENUS, actions: OPERATOR_ACTIONS },
  weighing_staff: {
    menus: WEIGHING_STAFF_MENUS,
    actions: WEIGHING_STAFF_ACTIONS,
  },
  supervisor: { menus: SUPERVISOR_MENUS, actions: SUPERVISOR_ACTIONS },
  elevated: { menus: ELEVATED_MENUS, actions: ELEVATED_ACTIONS },
}

export function mapLegacyRoleNameToAppRole(roleName: string): AppRole {
  return ROLE_ALIASES[roleName.trim().toLowerCase()] ?? "operator"
}

export function getDemoPermissions(role: string): UserPermissions {
  const appRole = mapLegacyRoleNameToAppRole(role)
  return ROLE_PERMISSIONS[appRole]
}
