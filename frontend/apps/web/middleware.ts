import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

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

  // ให้ /api ผ่านไป proxy หา backend — ห้าม redirect ไป login
  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  const token = request.cookies.get("auth_token")?.value
  const authMenus = request.cookies.get("auth_menus")?.value
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path))

  if (isPublicPath) {
    if (token && pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL(resolveLandingPath(authMenus), request.url))
    }
    return NextResponse.next()
  }

  if (!token) {
    const loginUrl = new URL("/login", request.url)
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
      return NextResponse.redirect(new URL(landing, request.url))
    }
  }

  if (requiredMenu && !hasMenuAccess(requiredMenu, authMenus)) {
    return NextResponse.redirect(new URL("/access-denied", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
