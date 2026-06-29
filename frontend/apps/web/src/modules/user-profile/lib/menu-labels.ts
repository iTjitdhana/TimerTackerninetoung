import type { MenuKey } from "@/shared/lib/permissions.constants"

const MENU_LABELS: Record<MenuKey, string> = {
  dashboard: "หน้าหลัก",
  production_list: "รายการงานผลิต",
  production_timer: "จับเวลาผลิต",
  production_summary: "สรุปผลผลิต",
  formula_weighing_list: "รายการตวงสูตร",
  formula_weighing: "ตวงสูตร",
  all_production_list: "งานผลิตทั้งหมด",
  admin_console: "จัดการผู้ใช้ (Admin)",
  cost_dashboard: "Dashboard ต้นทุน",
  fg_master_settings: "หน่วยสินค้า (FG)",
}

export function getMenuLabel(menuKey: MenuKey): string {
  return MENU_LABELS[menuKey] ?? menuKey
}

export function getMenuLabels(menus: MenuKey[]): string[] {
  return menus.map(getMenuLabel)
}
