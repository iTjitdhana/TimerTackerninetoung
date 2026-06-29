"use client"

import { useState, useCallback, useEffect } from "react"
import {
  Search, CalendarDays, AlertTriangle, CheckCircle, Clock,
  ChevronRight, X, Timer, Scale, Package, CircleCheck, CircleX,
  ArrowUp, ArrowDown, ArrowUpDown, BarChart2,
} from "lucide-react"
import { AppShell } from "@/shared/layout/AppShell"
import { useMounted } from "@/shared/hooks/useMounted"
import { useApiQuery } from "@/shared/hooks/useApiQuery"
import { Button } from "@/shared/ui/button"
import { costDashboardApi, type CostDashboardItem } from "../services/cost-dashboard.api"
import CompletenessTab from "./CompletenessTab"

type MainTab = "daily" | "completeness"

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
  return `${d.getDate()} ${thMonths[d.getMonth()]} ${d.getFullYear() + 543}`
}

function formatMinutes(minutes: number | null): string {
  if (minutes == null || minutes === 0) return "—"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} น.`
  return `${h} ชม.${m > 0 ? ` ${m} น.` : ""}`
}

function formatCost(value: number | null): string {
  if (value == null) return "—"
  return `฿${value.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatYield(value: number | null): string {
  if (value == null) return "—"
  return `${value.toFixed(1)}%`
}

function getTodayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })
}

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterKey = "all" | "warn" | "incomplete" | "low_yield"
type SortKey = "jobName" | "totalCost" | "yieldPercent" | "timeUsedMinutes"
type SortDir = "asc" | "desc"

interface SortState {
  key: SortKey | null
  dir: SortDir
}

// ─── Logic helpers ────────────────────────────────────────────────────────────

function applyFilter(items: CostDashboardItem[], filter: FilterKey): CostDashboardItem[] {
  switch (filter) {
    case "warn":
      return items.filter((item) => item.timerStatus === "warn")
    case "incomplete":
      return items.filter((item) => item.dataCompleteness.percent < 100)
    case "low_yield":
      return items.filter((item) => item.yieldPercent != null && item.yieldPercent < 75)
    default:
      return items
  }
}

function applySort(items: CostDashboardItem[], sort: SortState): CostDashboardItem[] {
  if (!sort.key) return items
  const key = sort.key
  return [...items].sort((a, b) => {
    const aVal = a[key]
    const bVal = b[key]
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1
    const compare =
      typeof aVal === "string"
        ? (aVal as string).localeCompare(bVal as string, "th")
        : (aVal as number) - (bVal as number)
    return sort.dir === "asc" ? compare : -compare
  })
}

function getRowAlertClass(item: CostDashboardItem): string {
  const isTimerWarn = item.timerStatus === "warn"
  const isLowYield = item.yieldPercent != null && item.yieldPercent < 75
  if (isTimerWarn || isLowYield) return "border-l-[3px] border-l-red-400"
  if (item.dataCompleteness.percent < 100) return "border-l-[3px] border-l-amber-400"
  return "border-l-[3px] border-l-transparent"
}

// ─── KPI Summary Cards ────────────────────────────────────────────────────────

function KpiSummaryCards({ items }: { items: CostDashboardItem[] }) {
  if (items.length === 0) return null

  const totalCostSum = items.reduce((sum, item) => sum + (item.totalCost ?? 0), 0)
  const yieldsWithData = items.filter((item) => item.yieldPercent != null)
  const avgYield =
    yieldsWithData.length > 0
      ? yieldsWithData.reduce((sum, item) => sum + item.yieldPercent!, 0) / yieldsWithData.length
      : null
  const completeCount = items.filter((item) => item.dataCompleteness.percent === 100).length
  const warnCount = items.filter((item) => item.timerStatus === "warn").length
  const allComplete = completeCount === items.length

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div className="bg-background rounded-xl border border-border p-4">
        <p className="text-xs text-muted-foreground mb-1.5">ต้นทุนรวมวันนี้</p>
        <p className="text-xl font-bold text-foreground leading-tight">
          {totalCostSum > 0 ? formatCost(totalCostSum) : "—"}
        </p>
      </div>

      <div className="bg-background rounded-xl border border-border p-4">
        <p className="text-xs text-muted-foreground mb-1.5">Yield เฉลี่ย</p>
        <p
          className={`text-xl font-bold leading-tight ${
            avgYield != null
              ? avgYield >= 75
                ? "text-green-700"
                : "text-red-600"
              : "text-muted-foreground"
          }`}
        >
          {avgYield != null ? `${avgYield.toFixed(1)}%` : "—"}
        </p>
      </div>

      <div className="bg-background rounded-xl border border-border p-4">
        <p className="text-xs text-muted-foreground mb-1.5">ข้อมูลครบ</p>
        <p
          className={`text-xl font-bold leading-tight ${
            allComplete ? "text-green-700" : "text-amber-600"
          }`}
        >
          {completeCount}
          <span className="text-base font-normal text-muted-foreground">/{items.length}</span>
          <span className="text-sm font-normal text-muted-foreground ml-1">รายการ</span>
        </p>
      </div>

      <div
        className={`rounded-xl border p-4 ${
          warnCount > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"
        }`}
      >
        <p className="text-xs text-muted-foreground mb-1.5">ต้องตรวจสอบ</p>
        <p
          className={`text-xl font-bold leading-tight ${
            warnCount > 0 ? "text-amber-700" : "text-green-700"
          }`}
        >
          {warnCount > 0 ? (
            <>
              {warnCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">รายการ</span>
            </>
          ) : (
            "ปกติ"
          )}
        </p>
      </div>
    </div>
  )
}

// ─── Filter Chips ─────────────────────────────────────────────────────────────

function FilterChips({
  items,
  activeFilter,
  onFilterChange,
}: {
  items: CostDashboardItem[]
  activeFilter: FilterKey
  onFilterChange: (filter: FilterKey) => void
}) {
  const counts: Record<FilterKey, number> = {
    all: items.length,
    warn: items.filter((item) => item.timerStatus === "warn").length,
    incomplete: items.filter((item) => item.dataCompleteness.percent < 100).length,
    low_yield: items.filter((item) => item.yieldPercent != null && item.yieldPercent < 75).length,
  }

  const chips: { key: FilterKey; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    { key: "warn", label: "ต้องตรวจสอบเวลา" },
    { key: "incomplete", label: "ข้อมูลไม่ครบ" },
    { key: "low_yield", label: "Yield ต่ำ" },
  ]

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {chips.map((chip) => {
        const count = counts[chip.key]
        const isActive = activeFilter === chip.key
        const hasIssue = chip.key !== "all" && count > 0

        return (
          <button
            key={chip.key}
            onClick={() => onFilterChange(chip.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border
              ${
                isActive
                  ? "bg-foreground text-background border-foreground"
                  : hasIssue
                  ? "bg-background text-foreground border-border hover:bg-muted/50"
                  : "bg-background text-muted-foreground border-border hover:bg-muted/50"
              }`}
          >
            {chip.label}
            <span
              className={`inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-semibold
                ${
                  isActive
                    ? "bg-foreground/20"
                    : hasIssue
                    ? "bg-muted text-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Sortable Column Header ───────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "right",
}: {
  label: string
  sortKey: SortKey
  sort: SortState
  onSort: (key: SortKey) => void
  align?: "left" | "right"
}) {
  const isActive = sort.key === sortKey
  const Icon = isActive ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <th
      className={`px-4 py-3 font-medium cursor-pointer select-none hover:text-foreground transition-colors ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={() => onSort(sortKey)}
    >
      <span
        className={`inline-flex items-center gap-1 ${
          align === "right" ? "flex-row-reverse justify-start" : ""
        }`}
      >
        {label}
        <Icon
          className={`w-3 h-3 shrink-0 ${
            isActive ? "text-foreground" : "text-muted-foreground/40"
          }`}
        />
      </span>
    </th>
  )
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function DataCompletenessBadge({
  completeness,
}: {
  completeness: CostDashboardItem["dataCompleteness"]
}) {
  const { percent } = completeness
  if (percent >= 100)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        <CheckCircle className="w-3 h-3" /> 100%
      </span>
    )
  if (percent >= 67)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <AlertTriangle className="w-3 h-3" /> 67%
      </span>
    )
  if (percent >= 33)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
        <AlertTriangle className="w-3 h-3" /> 33%
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
      <Clock className="w-3 h-3" /> 0%
    </span>
  )
}

function DataCompletenessBreakdown({
  completeness,
}: {
  completeness: CostDashboardItem["dataCompleteness"]
}) {
  const items = [
    { label: "ราคาวัตถุดิบ", done: completeness.hasMaterialWeighing, icon: Scale },
    { label: "กดเวลา", done: completeness.hasTimerData, icon: Timer },
    { label: "บันทึกผลผลิต", done: completeness.hasOutputQty, icon: Package },
  ] as const

  return (
    <div className="space-y-2">
      {items.map(({ label, done, icon: Icon }) => (
        <div key={label} className="flex items-center gap-2 text-sm">
          {done ? (
            <CircleCheck className="w-4 h-4 text-green-600 shrink-0" />
          ) : (
            <CircleX className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        </div>
      ))}
    </div>
  )
}

function TimerStatusBadge({ status }: { status: CostDashboardItem["timerStatus"] }) {
  if (status === "ok")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        <CheckCircle className="w-3 h-3" /> ปกติ
      </span>
    )
  if (status === "warn")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <AlertTriangle className="w-3 h-3" /> ตรวจสอบเวลา
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
      <Clock className="w-3 h-3" /> ไม่มีข้อมูล
    </span>
  )
}

// ─── Tables ───────────────────────────────────────────────────────────────────

function CostTable({
  items,
  onSelect,
  sort,
  onSort,
}: {
  items: CostDashboardItem[]
  onSelect: (item: CostDashboardItem) => void
  sort: SortState
  onSort: (key: SortKey) => void
}) {
  if (items.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
        <CalendarDays className="w-10 h-10 opacity-30" />
        <p className="text-sm">ไม่มี work plan ในวันนี้</p>
      </div>
    )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-xs">
            <SortHeader label="สินค้า" sortKey="jobName" sort={sort} onSort={onSort} align="left" />
            <th className="text-left px-4 py-3 font-medium">ผู้ปฏิบัติงาน</th>
            <SortHeader label="เวลา" sortKey="timeUsedMinutes" sort={sort} onSort={onSort} />
            <SortHeader label="% Yield" sortKey="yieldPercent" sort={sort} onSort={onSort} />
            <SortHeader label="ต้นทุนรวม" sortKey="totalCost" sort={sort} onSort={onSort} />
            <th className="text-left px-4 py-3 font-medium">ข้อมูลครบ</th>
            <th className="text-left px-4 py-3 font-medium">สถานะเวลา</th>
            <th className="w-8 px-2 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              onClick={() => onSelect(item)}
              className={`border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${getRowAlertClass(item)}`}
            >
              <td className="px-4 py-3">
                <p className="font-semibold text-foreground leading-snug">{item.jobName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.jobCode}</p>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-foreground">
                  {item.operators.length > 0 ? (
                    item.operators.join(", ")
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-sans text-muted-foreground whitespace-nowrap">
                {formatMinutes(item.timeUsedMinutes)}
              </td>
              <td
                className={`px-4 py-3 text-right font-sans font-semibold whitespace-nowrap ${
                  item.yieldPercent != null
                    ? item.yieldPercent >= 75
                      ? "text-green-700"
                      : "text-red-600"
                    : "text-muted-foreground"
                }`}
              >
                {formatYield(item.yieldPercent)}
              </td>
              <td className="px-4 py-3 text-right font-sans font-semibold whitespace-nowrap">
                {formatCost(item.totalCost)}
              </td>
              <td className="px-4 py-3">
                <DataCompletenessBadge completeness={item.dataCompleteness} />
              </td>
              <td className="px-4 py-3">
                <TimerStatusBadge status={item.timerStatus} />
              </td>
              <td className="px-2 py-3 text-muted-foreground">
                <ChevronRight className="w-4 h-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SearchResultTable({
  items,
  onSelect,
  sort,
  onSort,
}: {
  items: CostDashboardItem[]
  onSelect: (item: CostDashboardItem) => void
  sort: SortState
  onSort: (key: SortKey) => void
}) {
  if (items.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
        <Search className="w-10 h-10 opacity-30" />
        <p className="text-sm">ไม่พบข้อมูลที่ตรงกัน</p>
      </div>
    )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-xs">
            <SortHeader label="สินค้า" sortKey="jobName" sort={sort} onSort={onSort} align="left" />
            <th className="text-left px-4 py-3 font-medium">วันที่ผลิต</th>
            <th className="text-left px-4 py-3 font-medium">ผู้ปฏิบัติงาน</th>
            <SortHeader label="เวลา" sortKey="timeUsedMinutes" sort={sort} onSort={onSort} />
            <SortHeader label="% Yield" sortKey="yieldPercent" sort={sort} onSort={onSort} />
            <SortHeader label="ต้นทุนรวม" sortKey="totalCost" sort={sort} onSort={onSort} />
            <th className="text-left px-4 py-3 font-medium">ข้อมูลครบ</th>
            <th className="text-left px-4 py-3 font-medium">สถานะเวลา</th>
            <th className="w-8 px-2 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              onClick={() => onSelect(item)}
              className={`border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${getRowAlertClass(item)}`}
            >
              <td className="px-4 py-3">
                <p className="font-semibold text-foreground leading-snug">{item.jobName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.jobCode}</p>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                {formatDate(item.productionDate)}
              </td>
              <td className="px-4 py-3 text-sm">
                {item.operators.length > 0 ? (
                  item.operators.join(", ")
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-sans text-muted-foreground whitespace-nowrap">
                {formatMinutes(item.timeUsedMinutes)}
              </td>
              <td
                className={`px-4 py-3 text-right font-sans font-semibold whitespace-nowrap ${
                  item.yieldPercent != null
                    ? item.yieldPercent >= 75
                      ? "text-green-700"
                      : "text-red-600"
                    : "text-muted-foreground"
                }`}
              >
                {formatYield(item.yieldPercent)}
              </td>
              <td className="px-4 py-3 text-right font-sans font-semibold whitespace-nowrap">
                {formatCost(item.totalCost)}
              </td>
              <td className="px-4 py-3">
                <DataCompletenessBadge completeness={item.dataCompleteness} />
              </td>
              <td className="px-4 py-3">
                <TimerStatusBadge status={item.timerStatus} />
              </td>
              <td className="px-2 py-3 text-muted-foreground">
                <ChevronRight className="w-4 h-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function buildProductionTimerHref(item: CostDashboardItem): string | null {
  if (!item.jobId) return null
  const params = new URLSearchParams({
    job: item.jobName,
    jobId: item.jobId,
    source: "all-production",
  })
  return `/production-timer?${params.toString()}`
}

function DetailDrawer({ item, onClose }: { item: CostDashboardItem; onClose: () => void }) {
  const timerHref = buildProductionTimerHref(item)

  const handleOpenTimer = () => {
    if (!timerHref) return
    window.open(timerHref, "_blank", "noopener,noreferrer")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-background rounded-t-2xl md:rounded-2xl w-full md:max-w-lg shadow-xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-base leading-snug">{item.jobName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {item.jobCode} · {formatDate(item.productionDate)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "ต้นทุนรวม", value: formatCost(item.totalCost) },
            { label: "ต้นทุนวัตถุดิบ", value: formatCost(item.materialCost) },
            {
              label: "% Yield",
              value: formatYield(item.yieldPercent),
              color:
                item.yieldPercent != null
                  ? item.yieldPercent >= 75
                    ? "text-green-700"
                    : "text-red-600"
                  : "",
            },
            {
              label: "ปริมาณผลผลิต",
              value:
                item.outputQty != null ? `${item.outputQty} ${item.outputUnit ?? ""}` : "—",
            },
            { label: "เวลาผลิต", value: formatMinutes(item.timeUsedMinutes) },
            {
              label: "ผู้ปฏิบัติงาน",
              value: item.operators.length > 0 ? item.operators.join(", ") : "—",
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`font-semibold text-base ${color ?? ""}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="border border-border rounded-xl p-3 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">ความครบข้อมูลการผลิต</p>
            <div className="flex items-center gap-2 mb-3">
              <DataCompletenessBadge completeness={item.dataCompleteness} />
              <span className="text-xs text-muted-foreground">
                ตวงวัตถุดิบ → กดเวลา → บันทึกผลผลิต
              </span>
            </div>
            <DataCompletenessBreakdown completeness={item.dataCompleteness} />
          </div>
        </div>

        <div className="border border-border rounded-xl p-3 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">สถานะการกดเวลา</p>
            <TimerStatusBadge status={item.timerStatus} />
            {item.timerStatus === "warn" && (
              <p className="text-xs text-amber-700 mt-2">
                กรุณาตรวจสอบเวลาที่ใช้ในการผลิต — มีขั้นตอนที่ไม่ได้บันทึกเวลาครบถ้วน
              </p>
            )}
          </div>

          <Button
            type="button"
            variant={item.timerStatus === "warn" ? "default" : "outline"}
            className="w-full"
            disabled={!timerHref}
            onClick={handleOpenTimer}
          >
            <Timer className="w-4 h-4" />
            เปิด Production Timer
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CostDashboardPage() {
  const mounted = useMounted()
  const [activeTab, setActiveTab] = useState<MainTab>("daily")
  const [selectedDate, setSelectedDate] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [selectedItem, setSelectedItem] = useState<CostDashboardItem | null>(null)
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")
  const [sort, setSort] = useState<SortState>({ key: null, dir: "asc" })

  useEffect(() => {
    if (!mounted) return
    setSelectedDate(getTodayStr())
  }, [mounted])

  const isSearching = debouncedQuery.trim().length >= 2
  const canLoadDaily = mounted && selectedDate.length > 0 && !isSearching

  const { data: dailyData, isLoading: dailyLoading, error: dailyError, refetch: refetchDaily } = useApiQuery(
    () => costDashboardApi.getDaily(selectedDate),
    [selectedDate],
    { enabled: canLoadDaily },
  )

  const { data: searchData, isLoading: searchLoading } = useApiQuery(
    () => costDashboardApi.search(debouncedQuery),
    [debouncedQuery],
    { enabled: isSearching },
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value)
      if (value.trim().length < 2) setActiveFilter("all")
      if (searchTimer) clearTimeout(searchTimer)
      const t = setTimeout(() => setDebouncedQuery(value), 400)
      setSearchTimer(t)
    },
    [searchTimer],
  )

  const handleSort = useCallback((key: SortKey) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc",
    }))
  }, [])

  const rawItems = isSearching ? (searchData ?? []) : (dailyData ?? [])
  const filteredItems = isSearching ? rawItems : applyFilter(rawItems, activeFilter)
  const displayItems = applySort(filteredItems, sort)
  const isLoading = isSearching ? searchLoading : canLoadDaily ? dailyLoading : true

  return (
    <AppShell title="ต้นทุนการผลิต" shellClassName="bg-transparent">
      <div className="p-3 md:p-5 lg:p-6 max-w-6xl mx-auto">
        {/* Tab Navigation */}
        <div className="flex gap-1.5 mb-5 p-1 bg-muted rounded-xl w-fit border border-border">
          <button
            onClick={() => setActiveTab("daily")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "daily"
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            รายวัน / ค้นหา
          </button>
          <button
            onClick={() => setActiveTab("completeness")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "completeness"
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            ความครบข้อมูล
          </button>
        </div>

        {/* Completeness Summary Tab */}
        {activeTab === "completeness" && <CompletenessTab />}

        {/* Daily / Search Tab */}
        {activeTab === "daily" && <>
        {/* Search + Date */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="ค้นหาสินค้า รหัส หรือผู้ปฏิบัติงาน..."
              className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("")
                  setDebouncedQuery("")
                  setActiveFilter("all")
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!isSearching && (
            <div className="relative shrink-0">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value)
                    setActiveFilter("all")
                  }
                }}
                className="pl-9 pr-3 py-2.5 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          )}
        </div>

        {/* KPI Cards — daily only */}
        {!isSearching && !isLoading && (dailyData ?? []).length > 0 && (
          <KpiSummaryCards items={dailyData ?? []} />
        )}

        {/* Header + filter chips */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              {isSearching
                ? `ผลการค้นหา "${debouncedQuery}" — ${displayItems.length} รายการ`
                : `${formatDate(selectedDate)} — แสดง ${displayItems.length}/${rawItems.length} รายการ`}
            </p>
            {!isSearching && selectedDate !== getTodayStr() && (
              <button
                onClick={() => {
                  setSelectedDate(getTodayStr())
                  setActiveFilter("all")
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                กลับวันนี้
              </button>
            )}
          </div>

          {/* Filter chips — daily only */}
          {!isSearching && !isLoading && rawItems.length > 0 && (
            <FilterChips
              items={rawItems}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
          )}
        </div>

        {/* Table */}
        <div className="bg-background rounded-2xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="space-y-0">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3 border-b border-border/50 animate-pulse"
                >
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-muted rounded w-2/5" />
                    <div className="h-3 bg-muted rounded w-1/5" />
                  </div>
                  <div className="h-4 bg-muted rounded w-16" />
                  <div className="h-4 bg-muted rounded w-12" />
                  <div className="h-5 bg-muted rounded-full w-20" />
                </div>
              ))}
            </div>
          ) : !isSearching && dailyError ? (
            <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
              <AlertTriangle className="w-10 h-10 text-amber-500 opacity-80" />
              <div>
                <p className="text-sm font-medium text-foreground">โหลดข้อมูลไม่สำเร็จ</p>
                <p className="text-sm text-muted-foreground mt-1">
                  ไม่สามารถดึงรายการ work plan ได้ — ลองโหลดใหม่หรือตรวจสอบการเชื่อมต่อเซิร์ฟเวอร์
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchDaily()}>
                โหลดใหม่
              </Button>
            </div>
          ) : isSearching ? (
            <SearchResultTable
              items={displayItems}
              onSelect={setSelectedItem}
              sort={sort}
              onSort={handleSort}
            />
          ) : (
            <CostTable
              items={displayItems}
              onSelect={setSelectedItem}
              sort={sort}
              onSort={handleSort}
            />
          )}
        </div>
        </>}
      </div>

      {selectedItem && (
        <DetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </AppShell>
  )
}
