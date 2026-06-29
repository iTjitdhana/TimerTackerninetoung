import type { AuthSession, AuthSessionData, AuthUser, MenuKey, UserPermissions } from "./permissions.constants"

export const AUTH_USER_UPDATED_EVENT = "auth:user-updated"

export function notifyAuthUserUpdated() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(AUTH_USER_UPDATED_EVENT))
}

const AUTH_COOKIE = "auth_token"
const AUTH_MENUS_COOKIE = "auth_menus"
const AUTH_USER_KEY = "auth_user"
const AUTH_PERMISSIONS_KEY = "auth_permissions"
const MAX_AGE_SECONDS = 60 * 60 * 8 // 8 hours

function setCookie(name: string, value: string, maxAge = MAX_AGE_SECONDS) {
  if (typeof document === "undefined") return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

export function setAuthSession(session: AuthSession) {
  if (typeof window === "undefined") return
  localStorage.setItem(AUTH_COOKIE, session.token)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user))
  localStorage.setItem(AUTH_PERMISSIONS_KEY, JSON.stringify(session.permissions))
  setCookie(AUTH_COOKIE, session.token)
  setCookie(AUTH_MENUS_COOKIE, session.permissions.menus.join(","))
  notifyAuthUserUpdated()
}

export function updateAuthSessionData(data: AuthSessionData) {
  if (typeof window === "undefined") return
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user))
  localStorage.setItem(AUTH_PERMISSIONS_KEY, JSON.stringify(data.permissions))
  setCookie(AUTH_MENUS_COOKIE, data.permissions.menus.join(","))
  notifyAuthUserUpdated()
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(AUTH_COOKIE, token)
  setCookie(AUTH_COOKIE, token)
}

export function clearAuthToken() {
  if (typeof window === "undefined") return
  localStorage.removeItem(AUTH_COOKIE)
  localStorage.removeItem(AUTH_USER_KEY)
  localStorage.removeItem(AUTH_PERMISSIONS_KEY)
  clearCookie(AUTH_COOKIE)
  clearCookie(AUTH_MENUS_COOKIE)
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(AUTH_COOKIE)
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function getAuthUserName(): string {
  return getAuthUser()?.name ?? "พนักงาน"
}

export function getPermissions(): UserPermissions | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(AUTH_PERMISSIONS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UserPermissions
  } catch {
    return null
  }
}

export function canViewMenu(menuKey: MenuKey): boolean {
  const permissions = getPermissions()
  if (!permissions) return false
  return permissions.menus.includes(menuKey)
}

export function canAction(actionKey: UserPermissions["actions"][number]): boolean {
  const permissions = getPermissions()
  if (!permissions) return false
  return permissions.actions.includes(actionKey)
}

export type DashboardTab =
  | "weighing"
  | "weighing-rg"
  | "production"
  | "production-rg"
  | "all-production"

export function canViewDashboardTab(tab: DashboardTab): boolean {
  const isElevated = canViewMenu("all_production_list")

  switch (tab) {
    case "weighing":
      return canViewMenu("formula_weighing_list")
    case "weighing-rg":
    case "production-rg":
      return isElevated
    case "production":
      return canViewMenu("production_list")
    case "all-production":
      return isElevated
  }
}

export function getDefaultDashboardTab(): DashboardTab {
  if (canViewMenu("formula_weighing_list")) return "weighing"
  if (canViewMenu("production_list")) return "production"
  return "production"
}

export function getDefaultLandingPath(): string {
  if (canViewMenu("dashboard")) return "/"
  if (canViewMenu("formula_weighing_list")) return "/formula-weighing-list"
  if (canViewMenu("production_list")) return "/production-list"
  return "/access-denied"
}
