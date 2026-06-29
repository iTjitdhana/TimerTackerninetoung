import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AUTH_COOKIE, AUTH_MENUS_COOKIE } from "./src/shared/lib/auth-cookies"
import { withBasePath } from "./src/shared/lib/base-path"

const PUBLIC_PATHS = ["/login", "/register", "/access-denied"]

const ROUTE_MENUS: Record<string, string> = {
  "/formula-weighing-list": "formula_weighing_list",
  "/formula-weighing-settings": "formula_weighing_list",
  "/formula-weighing": "formula_weighing",
  "/production-list": "production_list",
  "/production-timer": "production_timer",
  "/production-summary": "production_summary",
  "/all-production-list": "all_production_list",
  "/all-production": "all_production_list",
  "/admin": "admin_console",
  "/cost-dashboard": "cost_dashboard",
  "/fg-master-settings": "fg_master_settings",
}

function redirectTo(path: string, request: NextRequest) {
  const target = path === "/" && process.env.NEXT_PUBLIC_BASE_PATH
    ? `${process.env.NEXT_PUBLIC_BASE_PATH.replace(/\/$/, "")}/`
    : withBasePath(path)
  return NextResponse.redirect(new URL(target, request.url))
}

function getRequiredMenu(pathname: string): string | null {
  if (pathname === "/") {
    return "dashboard"
  }

  for (const [route, menuKey] of Object.entries(ROUTE_MENUS)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return menuKey
    }
  }
  return null
}

function parseAuthMenus(authMenusCookie?: string): string[] {
  if (!authMenusCookie) return []
  return decodeURIComponent(authMenusCookie)
    .split(",")
    .map((menu) => menu.trim())
    .filter(Boolean)
}

function hasMenuAccess(requiredMenu: string, authMenusCookie?: string): boolean {
  return parseAuthMenus(authMenusCookie).includes(requiredMenu)
}

function resolveLandingPath(authMenus?: string): string {
  if (hasMenuAccess("dashboard", authMenus)) return "/"
  if (hasMenuAccess("formula_weighing_list", authMenus)) return "/formula-weighing-list"
  if (hasMenuAccess("production_list", authMenus)) return "/production-list"
  return "/access-denied"
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value
  const authMenus = request.cookies.get(AUTH_MENUS_COOKIE)?.value
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path))

  if (isPublicPath) {
    if (token && pathname.startsWith("/login")) {
      return redirectTo(resolveLandingPath(authMenus), request)
    }
    return NextResponse.next()
  }

  if (!token) {
    const loginUrl = new URL(withBasePath("/login"), request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const requiredMenu = getRequiredMenu(pathname)
  if (
    requiredMenu === "dashboard" &&
    token &&
    !hasMenuAccess("dashboard", authMenus)
  ) {
    const landing = resolveLandingPath(authMenus)
    if (landing !== "/" && landing !== pathname) {
      return redirectTo(landing, request)
    }
  }

  if (requiredMenu && !hasMenuAccess(requiredMenu, authMenus)) {
    return redirectTo("/access-denied", request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
