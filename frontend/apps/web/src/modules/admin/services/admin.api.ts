import { apiClient } from "@/shared/api-client"
import type { AppRole } from "@/shared/lib/permissions.constants"

export interface AdminUser {
  id: number
  idCode: string
  name: string
  department: string | null
  position: string | null
  roleId: number | null
  roleName: string | null
  roleDisplayName: string | null
  appRole?: AppRole | null
  isActive: boolean
}

export interface AdminRole {
  id: number
  role_name: string
  display_name: string
  color: string | null
  appRole: string
  canReadAllJobs: boolean
  canReadAllWeighingJobs: boolean
  canAdmin: boolean
}

export interface AdminAuthConfig {
  ownAuth: boolean
}

export interface AdminMenu {
  menu_key: string
  label: string
  path: string
  menu_group: string | null
}

export interface RoleMenu {
  menuKey: string
  canView: boolean
}

export interface ResetPinResult {
  id: number
  idCode: string
  name: string
  tempPin: string
}

export interface UpdateUserPayload {
  roleId?: number
  appRole?: AppRole
  isActive?: boolean
}

export interface CreateUserPayload {
  name: string
  idCode: string
  tempPin: string
  roleId?: number
  appRole?: AppRole
}

export const adminApi = {
  getConfig() {
    return apiClient.get<AdminAuthConfig>("/admin/config")
  },
  listUsers() {
    return apiClient.get<AdminUser[]>("/admin/users")
  },
  createUser(payload: CreateUserPayload) {
    return apiClient.post<AdminUser>("/admin/users", payload)
  },
  updateUser(id: number, payload: UpdateUserPayload) {
    return apiClient.patch<AdminUser>(`/admin/users/${id}`, payload)
  },
  resetPin(id: number) {
    return apiClient.post<ResetPinResult>(`/admin/users/${id}/reset-pin`, {})
  },
  listRoles() {
    return apiClient.get<AdminRole[]>("/admin/roles")
  },
  listMenus() {
    return apiClient.get<AdminMenu[]>("/admin/menus")
  },
  getRoleMenus(roleId: number) {
    return apiClient.get<RoleMenu[]>(`/admin/roles/${roleId}/menus`)
  },
  updateRoleMenus(roleId: number, items: RoleMenu[]) {
    return apiClient.put<RoleMenu[]>(`/admin/roles/${roleId}/menus`, { items })
  },
}
