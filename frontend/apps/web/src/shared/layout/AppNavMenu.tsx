"use client"

import Link from "next/link"
import { Home, LogOut, Package, ShieldCheck, Timer, TrendingUp, Weight } from "lucide-react"
import { canViewMenu } from "@/shared/lib/auth"
import type { MenuKey } from "@/shared/lib/permissions.constants"
import { cn } from "@/shared/lib/utils"

export const appNavSheetClassName =
  "w-[300px] md:w-[400px] gap-0 border-r border-blue-300/25 !bg-blue-700/28 text-white shadow-2xl backdrop-blur-xl backdrop-saturate-150 [&>button]:rounded-lg [&>button]:text-white [&>button]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] [&>button]:hover:bg-white/20"

export const appNavSheetOverlayClassName = "bg-black/15"

export const appNavSheetHeaderClassName = "border-b border-white/15 px-4 py-4 bg-transparent"

export const appNavSheetTitleClassName = "text-lg font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"

export const appNavMenuIconClassName =
  "h-5 w-5 shrink-0 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] md:h-6 md:w-6"

export const appNavMenuLabelClassName =
  "text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] md:text-base"

export const appNavMenuSubLabelClassName =
  "text-xs font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] md:text-sm"

export const appNavLogoutLabelClassName =
  "text-sm font-semibold text-red-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] md:text-base"

export const appNavProfileLinkClassName =
  "mx-3 my-2 flex w-[calc(100%-1.5rem)] items-center justify-between gap-3 rounded-xl border border-white/10 bg-blue-400/22 p-4 text-white transition-colors hover:bg-blue-400/32 focus:outline-none"

interface AppNavMenuProps {
  activeMenu?: MenuKey
  onNavigate?: () => void
  onLogout: () => void
  showProfile?: boolean
  profileSlot?: React.ReactNode
}

export function AppNavMenu({
  activeMenu,
  onNavigate,
  onLogout,
  showProfile = false,
  profileSlot,
}: AppNavMenuProps) {
  const close = () => onNavigate?.()

  const linkClass = (menu: MenuKey, extra = "") =>
    cn(
      "mx-3 my-2 flex items-center gap-3 w-[calc(100%-1.5rem)] rounded-xl p-4 transition-colors border border-white/10 focus:outline-none text-white",
      activeMenu === menu ? "bg-blue-400/32" : "bg-blue-400/18 hover:bg-blue-400/28",
      extra,
    )

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="mt-2 flex-1 bg-transparent">
        {canViewMenu("dashboard") ? (
          <Link href="/" onClick={close}>
            <button type="button" className={linkClass("dashboard")}>
              <Home className={appNavMenuIconClassName} />
              <span className={appNavMenuLabelClassName}>หน้าหลัก</span>
            </button>
          </Link>
        ) : null}

        {canViewMenu("formula_weighing_list") ? (
          <Link href="/formula-weighing-list" onClick={close}>
            <button type="button" className={linkClass("formula_weighing_list")}>
              <Weight className={appNavMenuIconClassName} />
              <span className={appNavMenuLabelClassName}>งานตวงสูตร</span>
            </button>
          </Link>
        ) : null}

        {canViewMenu("production_list") ? (
          <Link href="/production-list" onClick={close}>
            <button type="button" className={linkClass("production_list")}>
              <Timer className={appNavMenuIconClassName} />
              <span className={appNavMenuLabelClassName}>งานผลิต</span>
            </button>
          </Link>
        ) : null}

        {canViewMenu("all_production_list") ? (
          <Link href="/all-production-list" onClick={close}>
            <button type="button" className={linkClass("all_production_list")}>
              <Timer className={appNavMenuIconClassName} />
              <span className={appNavMenuLabelClassName}>งานผลิตทั้งหมด</span>
            </button>
          </Link>
        ) : null}

        {canViewMenu("cost_dashboard") ? (
          <Link href="/cost-dashboard" onClick={close}>
            <button type="button" className={linkClass("cost_dashboard")}>
              <TrendingUp className={appNavMenuIconClassName} />
              <span className={appNavMenuLabelClassName}>Dashboard ต้นทุน</span>
            </button>
          </Link>
        ) : null}

        {canViewMenu("fg_master_settings") ? (
          <Link href="/fg-master-settings" onClick={close}>
            <button type="button" className={linkClass("fg_master_settings")}>
              <Package className={appNavMenuIconClassName} />
              <span className={appNavMenuLabelClassName}>หน่วยสินค้า (FG)</span>
            </button>
          </Link>
        ) : null}

        {canViewMenu("admin_console") ? (
          <Link href="/admin" onClick={close}>
            <button type="button" className={linkClass("admin_console")}>
              <ShieldCheck className={appNavMenuIconClassName} />
              <span className={appNavMenuLabelClassName}>จัดการผู้ใช้และสิทธิ์</span>
            </button>
          </Link>
        ) : null}
      </div>

      {showProfile && profileSlot ? (
        <div className="border-t border-white/15 bg-transparent">{profileSlot}</div>
      ) : null}

      <div className={showProfile && profileSlot ? "bg-transparent" : "border-t border-white/15 bg-transparent"}>
        <button
          type="button"
          onClick={onLogout}
          className="mx-3 my-2 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-xl border border-white/10 bg-blue-400/18 p-4 transition-colors hover:bg-red-400/25 focus:outline-none"
        >
          <LogOut className={cn(appNavMenuIconClassName, "text-red-300")} />
          <span className={appNavLogoutLabelClassName}>ออกจากระบบ</span>
        </button>
      </div>
    </div>
  )
}
