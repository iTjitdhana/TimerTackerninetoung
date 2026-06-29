export const SELECTED_BU_STORAGE_KEY = "timetracker.selectedBuId"

export type SelectedBuFilter = number | "all"

export const DEFAULT_BU_ID = 1
export const ROGANG_BU_ID = 2

export function getStoredBuFilter(): SelectedBuFilter {
  if (typeof window === "undefined") {
    return DEFAULT_BU_ID
  }

  const stored = localStorage.getItem(SELECTED_BU_STORAGE_KEY)
  if (stored === "all") {
    return "all"
  }

  const parsed = Number.parseInt(stored ?? String(DEFAULT_BU_ID), 10)
  return Number.isNaN(parsed) ? DEFAULT_BU_ID : parsed
}

export function setStoredBuFilter(value: SelectedBuFilter) {
  localStorage.setItem(SELECTED_BU_STORAGE_KEY, String(value))
}

export function toBuIdQueryParam(filter: SelectedBuFilter): number | undefined {
  return filter === "all" ? undefined : filter
}
