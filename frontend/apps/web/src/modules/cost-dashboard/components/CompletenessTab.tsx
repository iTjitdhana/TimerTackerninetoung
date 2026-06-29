"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { CalendarDays, Scale, Timer, Package, TrendingUp, AlertTriangle, CheckCircle, Factory, ShoppingCart, Leaf, FlaskConical, RefreshCw, HelpCircle, X, Eye } from "lucide-react"
import { useApiQuery } from "@/shared/hooks/useApiQuery"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { costDashboardApi, type CompletenessSummary, type CompletenessPatternGroup, type JobCategoryBreakdown, type JobCategory } from "../services/cost-dashboard.api"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })
}

function getFirstDayOfMonthStr(): string {
  const d = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

function formatDateTH(dateStr: string): string {
  const d = new Date(dateStr)
  const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
  return `${d.getDate()} ${thMonths[d.getMonth()]} ${d.getFullYear() + 543}`
}

function buildProductionTimerHref(jobId: number, jobName: string | null): string {
  const params = new URLSearchParams({
    job: jobName ?? "",
    jobId: String(jobId),
    source: "cost-dashboard",
  })
  return `/production-timer?${params.toString()}`
}

function buildFormulaWeighingHref(
  jobId: number,
  jobName: string | null,
  productionDate: string,
): string {
  const params = new URLSearchParams({
    job: jobName ?? "",
    jobId: String(jobId),
    productionDate,
  })
  return `/formula-weighing?${params.toString()}`
}

function openInNewTab(href: string) {
  window.open(href, "_blank", "noopener,noreferrer")
}

// ─── Group config ─────────────────────────────────────────────────────────────

interface GroupConfig {
  percent: number
  label: string
  sublabel: string
  color: string
  bg: string
  border: string
  textColor: string
  barColor: string
}

const GROUP_CONFIGS: GroupConfig[] = [
  {
    percent: 100,
    label: "ข้อมูลครบสมบูรณ์",
    sublabel: "ราคาวัตถุดิบ + กดเวลา + บันทึกผลผลิต",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    textColor: "text-green-700",
    barColor: "bg-green-500",
  },
  {
    percent: 67,
    label: "ขาด 1 รายการ",
    sublabel: "มีข้อมูล 2 ใน 3 ส่วน",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    textColor: "text-amber-700",
    barColor: "bg-amber-400",
  },
  {
    percent: 33,
    label: "ขาด 2 รายการ",
    sublabel: "มีข้อมูลเพียง 1 ใน 3 ส่วน",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    textColor: "text-orange-700",
    barColor: "bg-orange-400",
  },
  {
    percent: 0,
    label: "ไม่มีข้อมูลผลิต",
    sublabel: "ยังไม่ได้บันทึกข้อมูลใดเลย",
    color: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
    textColor: "text-muted-foreground",
    barColor: "bg-muted-foreground/30",
  },
]

function getGroupConfig(percent: number): GroupConfig {
  return GROUP_CONFIGS.find((c) => c.percent === percent) ?? GROUP_CONFIGS[3]
}

// ─── Date Range Presets ───────────────────────────────────────────────────────

interface DateRangePreset {
  label: string
  from: string
  to: string
}

function getPresets(today: string): DateRangePreset[] {
  const d = new Date(today)
  const firstOfMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`

  const prevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  const lastOfPrevMonth = new Date(d.getFullYear(), d.getMonth(), 0)
  const prevFrom = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-01`
  const prevTo = `${lastOfPrevMonth.getFullYear()}-${String(lastOfPrevMonth.getMonth() + 1).padStart(2, "0")}-${String(lastOfPrevMonth.getDate()).padStart(2, "0")}`

  const past7 = new Date(d)
  past7.setDate(d.getDate() - 6)
  const past7Str = past7.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })

  const past30 = new Date(d)
  past30.setDate(d.getDate() - 29)
  const past30Str = past30.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })

  return [
    { label: "เดือนนี้", from: firstOfMonth, to: today },
    { label: "7 วันล่าสุด", from: past7Str, to: today },
    { label: "30 วันล่าสุด", from: past30Str, to: today },
    { label: "เดือนที่แล้ว", from: prevFrom, to: prevTo },
  ]
}

// ─── Pattern config ───────────────────────────────────────────────────────────

interface PatternConfig {
  label: string
  sublabel: string
  barColor: string
  bg: string
  border: string
  textColor: string
  severity: 0 | 1 | 2 | 3   // 0=complete, 1=missing1, 2=missing2, 3=missing all
}

const PATTERN_CONFIG: Record<string, PatternConfig> = {
  "1_1_1": {
    label: "ครบสมบูรณ์",
    sublabel: "ราคาวัตถุดิบ + กดเวลา + บันทึกผลผลิต",
    barColor: "bg-green-500",
    bg: "bg-green-50",
    border: "border-green-200",
    textColor: "text-green-700",
    severity: 0,
  },
  "0_1_1": {
    label: "ขาดราคาวัตถุดิบ",
    sublabel: "วัตถุดิบบางรายการยังไม่มีราคา",
    barColor: "bg-amber-400",
    bg: "bg-amber-50",
    border: "border-amber-200",
    textColor: "text-amber-700",
    severity: 1,
  },
  "1_1_0": {
    label: "ขาดบันทึกผลผลิต",
    sublabel: "ยังไม่มีจำนวนสินค้าที่ผลิตได้",
    barColor: "bg-amber-400",
    bg: "bg-amber-50",
    border: "border-amber-200",
    textColor: "text-amber-700",
    severity: 1,
  },
  "1_0_1": {
    label: "ขาดกดเวลา",
    sublabel: "มีราคาและผลผลิต แต่ขาดเวลาผลิต",
    barColor: "bg-yellow-400",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    textColor: "text-yellow-700",
    severity: 1,
  },
  "0_1_0": {
    label: "ขาดราคา + ผลผลิต",
    sublabel: "ต้นทุนและ Yield คำนวณไม่ได้",
    barColor: "bg-orange-500",
    bg: "bg-orange-50",
    border: "border-orange-200",
    textColor: "text-orange-700",
    severity: 2,
  },
  "0_0_1": {
    label: "ขาดราคา + กดเวลา",
    sublabel: "มีเฉพาะผลผลิต",
    barColor: "bg-orange-400",
    bg: "bg-orange-50",
    border: "border-orange-200",
    textColor: "text-orange-700",
    severity: 2,
  },
  "1_0_0": {
    label: "ขาดกดเวลา + ผลผลิต",
    sublabel: "มีเฉพาะราคาวัตถุดิบ",
    barColor: "bg-orange-400",
    bg: "bg-orange-50",
    border: "border-orange-200",
    textColor: "text-orange-700",
    severity: 2,
  },
  "0_0_0": {
    label: "ไม่มีข้อมูลเลย",
    sublabel: "แผนผลิตที่ยังไม่เริ่มต้น",
    barColor: "bg-muted-foreground/30",
    bg: "bg-muted",
    border: "border-border",
    textColor: "text-muted-foreground",
    severity: 3,
  },
}

function getPatternConfig(pattern: string): PatternConfig {
  return PATTERN_CONFIG[pattern] ?? PATTERN_CONFIG["0_0_0"]
}

// ─── Pattern Stacked Bar ──────────────────────────────────────────────────────

function PatternBar({
  groups,
  total,
}: {
  groups: CompletenessPatternGroup[]
  total: number
}) {
  if (total === 0) return null
  const active = groups.filter((g) => g.count > 0)

  return (
    <div className="space-y-2">
      <div className="flex h-8 rounded-xl overflow-hidden gap-px">
        {active.map((g) => {
          const cfg = getPatternConfig(g.pattern)
          const pct = (g.count / total) * 100
          return (
            <div
              key={g.pattern}
              className={`${cfg.barColor} flex items-center justify-center transition-all`}
              style={{ width: `${pct}%` }}
              title={`${cfg.label}: ${g.count} รายการ (${pct.toFixed(1)}%)`}
            >
              {pct > 8 && (
                <span className="text-white text-xs font-semibold drop-shadow-sm">
                  {pct.toFixed(0)}%
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {active.map((g) => {
          const cfg = getPatternConfig(g.pattern)
          return (
            <div key={g.pattern} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${cfg.barColor}`} />
              <span>{cfg.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Pattern Row ──────────────────────────────────────────────────────────────

function FieldDot({ present }: { present: boolean }) {
  return present ? (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 text-[10px] font-bold">✓</span>
  ) : (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-500 text-[10px] font-bold">✗</span>
  )
}

function PatternRow({
  group,
  total,
  index,
  onPreview,
}: {
  group: CompletenessPatternGroup
  total: number
  index: number
  onPreview?: () => void
}) {
  const cfg = getPatternConfig(group.pattern)
  const pct = total > 0 ? ((group.count / total) * 100).toFixed(1) : "0.0"

  return (
    <div className={`rounded-xl border p-3 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center gap-3">
        {/* Rank */}
        <span className="w-5 h-5 rounded-full bg-background text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>

        {/* Field dots */}
        <div className="flex items-center gap-1 shrink-0" title="ราคาวัตถุดิบ | กดเวลา | บันทึกผลผลิต">
          <FieldDot present={group.hasPrice} />
          <FieldDot present={group.hasTimer} />
          <FieldDot present={group.hasOutput} />
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${cfg.textColor}`}>{cfg.label}</p>
        </div>

        {/* Count + preview */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end gap-1 min-w-[56px]">
            <p className={`text-lg font-bold leading-none ${cfg.textColor}`}>
              {group.count.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{pct}%</p>
          </div>
          {onPreview && group.count > 0 && (
            <button
              type="button"
              onClick={onPreview}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-background transition-colors"
              title="ดูรายการในกลุ่มนี้"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full ${cfg.barColor} rounded-full transition-all`}
          style={{ width: `${group.ratio * 100}%` }}
        />
      </div>
    </div>
  )
}

// ─── Field Breakdown ──────────────────────────────────────────────────────────

function FieldBreakdown({
  byField,
  total,
}: {
  byField: CompletenessSummary["byField"]
  total: number
}) {
  const fields = [
    { key: "hasMaterialPriced" as const, label: "ราคาวัตถุดิบครบ", icon: Scale },
    { key: "hasTimerData" as const, label: "กดเวลาผลิต", icon: Timer },
    { key: "hasOutputQty" as const, label: "บันทึกจำนวนผลิต", icon: Package },
    {
      key: "hasVerifiedConversion" as const,
      label: "อัตราแปลงยืนยัน ณ ตอนบันทึก",
      icon: CheckCircle,
      denominatorKey: "hasOutputQty" as const,
    },
  ]

  return (
    <div className="space-y-2">
      {fields.map(({ key, label, icon: Icon, denominatorKey }) => {
        const count = byField[key]
        const denominator = denominatorKey ? byField[denominatorKey] : total
        const ratio = denominator > 0 ? count / denominator : 0
        const pct = (ratio * 100).toFixed(1)
        const isGood = ratio >= 0.8
        const isMid = ratio >= 0.5 && ratio < 0.8

        return (
          <div key={key} className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${isGood ? "bg-green-50" : isMid ? "bg-amber-50" : "bg-muted"}`}>
              <Icon className={`w-3.5 h-3.5 ${isGood ? "text-green-600" : isMid ? "text-amber-600" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-foreground truncate">{label}</p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {count}/{denominator} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isGood ? "bg-green-500" : isMid ? "bg-amber-400" : "bg-muted-foreground/40"}`}
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Category config ──────────────────────────────────────────────────────────

interface CategoryConfig {
  key: JobCategory
  label: string
  sublabel?: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
  barColor: string
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    key: "production",
    label: "งาน Production",
    icon: Factory,
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    barColor: "bg-blue-500",
  },
  {
    key: "repack",
    label: "งาน Repack",
    icon: RefreshCw,
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    barColor: "bg-purple-400",
  },
  {
    key: "vegetable",
    label: "งานทำผัก",
    icon: Leaf,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    barColor: "bg-emerald-400",
  },
  {
    key: "requisition",
    label: "งานเบิกของ",
    icon: ShoppingCart,
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    barColor: "bg-orange-400",
  },
  {
    key: "formula",
    label: "งานตวงสูตร",
    icon: FlaskConical,
    color: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-200",
    barColor: "bg-sky-400",
  },
  {
    key: "other",
    label: "อื่น ๆ",
    sublabel: "งานธุรการ ทำความสะอาด และงานสนับสนุนที่ไม่ใช่การผลิตสินค้า",
    icon: HelpCircle,
    color: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
    barColor: "bg-muted-foreground/40",
  },
]

function getCategoryConfig(key: JobCategory): CategoryConfig {
  return CATEGORY_CONFIGS.find((c) => c.key === key) ?? CATEGORY_CONFIGS[5]
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function ProductionPatternPreviewModal({
  from,
  to,
  pattern,
  onClose,
}: {
  from: string
  to: string
  pattern: string
  onClose: () => void
}) {
  const cfg = getPatternConfig(pattern)
  const { data, isLoading } = useApiQuery(
    () => costDashboardApi.getProductionPatternPreview(from, to, pattern),
    [from, to, pattern],
    { enabled: true },
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-background rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-base">{cfg.label}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              รายการงาน Production ในช่วงที่เลือก
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {isLoading && (
            <div className="p-4 space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-9 bg-muted rounded-lg" />
              ))}
            </div>
          )}
          {!isLoading && (!data || data.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <CheckCircle className="w-8 h-8 opacity-30" />
              <p className="text-sm">ไม่มีรายการในกลุ่มนี้</p>
            </div>
          )}
          {!isLoading && data && data.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-medium">ชื่องาน</th>
                  <th className="text-left px-4 py-2.5 font-medium">รหัส</th>
                  <th className="text-left px-4 py-2.5 font-medium">วันที่</th>
                  <th className="text-center px-4 py-2.5 font-medium" title="ราคา | เวลา | ผลผลิต">ข้อมูล</th>
                  <th className="text-right px-3 py-2.5 font-medium">เปิด</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {item.jobName ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono">{item.jobCode}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{item.productionDate}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <FieldDot present={item.hasPrice} />
                        <FieldDot present={item.hasTimer} />
                        <FieldDot present={item.hasOutput} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            openInNewTab(
                              buildFormulaWeighingHref(
                                item.id,
                                item.jobName,
                                item.productionDate,
                              ),
                            )
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                          title="เปิดหน้าตวงสูตรในแท็บใหม่"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">ตวงสูตร</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openInNewTab(
                              buildProductionTimerHref(item.id, item.jobName),
                            )
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                          title="เปิด Production Timer ในแท็บใหม่"
                        >
                          <Timer className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Timer</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!isLoading && data && data.length > 0 && (
          <div className="p-3 border-t border-border shrink-0 bg-muted rounded-b-2xl">
            <p className="text-xs text-muted-foreground">
              แสดง {data.length.toLocaleString()} รายการ — กดปุ่มเพื่อเปิดหน้าตวงสูตรหรือ Production Timer
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function UnverifiedConversionPreviewModal({
  from,
  to,
  onClose,
}: {
  from: string
  to: string
  onClose: () => void
}) {
  const { canAction } = usePermissions()
  const canManageFg = canAction("fg_master.write")
  const { data, isLoading } = useApiQuery(
    () => costDashboardApi.getUnverifiedConversionPreview(from, to),
    [from, to],
    { enabled: true },
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-background rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-base">อัตราแปลงยังไม่ยืนยัน</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              งานที่บันทึกผลผลิตแล้วแต่หน่วย/conversion อาจไม่ถูกต้อง
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {isLoading && (
            <div className="p-4 space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-9 bg-muted rounded-lg" />
              ))}
            </div>
          )}
          {!isLoading && (!data || data.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <CheckCircle className="w-8 h-8 opacity-30" />
              <p className="text-sm">ไม่มีงานที่อัตราแปลงยังไม่ยืนยัน</p>
            </div>
          )}
          {!isLoading && data && data.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-medium">ชื่องาน</th>
                  <th className="text-left px-4 py-2.5 font-medium">รหัส</th>
                  <th className="text-left px-4 py-2.5 font-medium">วันที่</th>
                  <th className="text-right px-3 py-2.5 font-medium">เปิด</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr
                    key={item.jobId}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-foreground">{item.jobName ?? "—"}</p>
                      {item.conversionWarnings[0] ? (
                        <p className="text-xs text-amber-700 mt-0.5">{item.conversionWarnings[0]}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono">
                      {item.jobCode}
                      {item.fgCode ? (
                        <span className="block text-[10px]">FG: {item.fgCode}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                      {item.productionDate}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            openInNewTab(
                              buildProductionTimerHref(item.jobId, item.jobName),
                            )
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                        >
                          <Timer className="w-3.5 h-3.5" />
                          Timer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {canManageFg ? (
          <div className="p-3 border-t border-border shrink-0 bg-muted/40 rounded-b-2xl">
            <Link
              href="/fg-master-settings"
              className="text-xs font-medium text-primary hover:underline"
            >
              จัดการหน่วยสินค้า (FG master)
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function NonProductionPreviewModal({
  from,
  to,
  onClose,
}: {
  from: string
  to: string
  onClose: () => void
}) {
  const { data, isLoading } = useApiQuery(
    () => costDashboardApi.getNonProductionPreview(from, to),
    [from, to],
    { enabled: true },
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-background rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-base">รายการงานที่ไม่ใช่ Production</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              เบิกของ ทำผัก Repack ตวงสูตร และงานสนับสนุนอื่น ๆ
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {isLoading && (
            <div className="p-4 space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-9 bg-muted rounded-lg" />
              ))}
            </div>
          )}
          {!isLoading && (!data || data.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <CheckCircle className="w-8 h-8 opacity-30" />
              <p className="text-sm">ไม่มีรายการในช่วงนี้</p>
            </div>
          )}
          {!isLoading && data && data.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-medium">ชื่องาน</th>
                  <th className="text-left px-4 py-2.5 font-medium">รหัส</th>
                  <th className="text-left px-4 py-2.5 font-medium">วันที่</th>
                  <th className="text-left px-4 py-2.5 font-medium">กลุ่ม</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => {
                  const cfg = getCategoryConfig(item.category)
                  return (
                    <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {item.jobName ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono">{item.jobCode}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{item.productionDate}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                          <cfg.icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!isLoading && data && data.length > 0 && (
          <div className="p-3 border-t border-border shrink-0 bg-muted rounded-b-2xl">
            <p className="text-xs text-muted-foreground">
              แสดง {data.length.toLocaleString()} รายการ
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export default function CompletenessTab() {
  const today = getTodayStr()
  const [from, setFrom] = useState(getFirstDayOfMonthStr())
  const [to, setTo] = useState(today)
  const [activePreset, setActivePreset] = useState<string | null>("เดือนนี้")
  const [mounted, setMounted] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewPattern, setPreviewPattern] = useState<string | null>(null)
  const [showUnverifiedPreview, setShowUnverifiedPreview] = useState(false)
  const { canAction } = usePermissions()
  const canManageFg = canAction("fg_master.read")

  useEffect(() => {
    setMounted(true)
  }, [])

  const presets = getPresets(today)

  const { data, isLoading } = useApiQuery(
    () => costDashboardApi.getCompletenessSummary(from, to),
    [from, to],
    { enabled: mounted && !!from && !!to && from <= to },
  )

  function handlePreset(preset: DateRangePreset) {
    setFrom(preset.from)
    setTo(preset.to)
    setActivePreset(preset.label)
  }

  function handleFromChange(value: string) {
    setFrom(value)
    setActivePreset(null)
  }

  function handleToChange(value: string) {
    setTo(value)
    setActivePreset(null)
  }

  const total = data?.total ?? 0
  const byCategory = data?.byCategory
  const productionCount = data?.productionCount ?? byCategory?.production ?? 0
  const nonProductionCount = total - productionCount
  const patternGroups = data?.groupsByPattern ?? []
  const patternSum = patternGroups.reduce((sum, g) => sum + g.count, 0)
  const completeCount = patternGroups.find((g) => g.pattern === "1_1_1")?.count ?? 0
  const noDataCount = patternGroups.find((g) => g.pattern === "0_0_0")?.count ?? 0
  const partialCount = productionCount - completeCount - noDataCount

  return (
    <div className="space-y-5">
      {/* Date Range Selector */}
      <div className="bg-background rounded-2xl border border-border p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">ช่วงแผนผลิตที่ต้องการดู</p>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activePreset === preset.label
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:bg-muted/50"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative shrink-0">
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => { if (e.target.value) handleFromChange(e.target.value) }}
              className="pl-8 pr-3 py-2 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
          <span className="text-muted-foreground text-sm">—</span>
          <div className="relative shrink-0">
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => { if (e.target.value) handleToChange(e.target.value) }}
              className="pl-8 pr-3 py-2 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
          {from && to && (
            <p className="text-xs text-muted-foreground">
              {formatDateTH(from)} – {formatDateTH(to)}
            </p>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-muted rounded-xl h-20" />
            ))}
          </div>
          <div className="bg-muted rounded-xl h-24" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-muted rounded-xl h-24" />
            ))}
          </div>
        </div>
      )}

      {/* No data */}
      {!isLoading && data && total === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <CalendarDays className="w-10 h-10 opacity-30" />
          <p className="text-sm">ไม่มีแผนผลิตในช่วงที่เลือก</p>
        </div>
      )}

      {/* Summary */}
      {!isLoading && data && total > 0 && (
        <>
          {/* Category overview */}
          <div className="bg-background rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-foreground">
                แผนผลิตทั้งหมด{" "}
                <span className="font-bold">{total.toLocaleString()}</span>{" "}
                รายการ
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {formatDateTH(from)} – {formatDateTH(to)}
                </p>
                {nonProductionCount > 0 && (
                  <button
                    onClick={() => setShowPreview(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
                    title="ดูรายการที่ไม่ใช่ Production"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    ดูรายการ
                  </button>
                )}
              </div>
            </div>

            {/* Stacked category bar */}
            <div className="flex h-6 rounded-lg overflow-hidden mb-3 gap-px">
              {CATEGORY_CONFIGS.map(({ key, barColor, label }) => {
                const count = byCategory?.[key] ?? 0
                if (count === 0) return null
                const pct = (count / total) * 100
                return (
                  <div
                    key={key}
                    className={`${barColor} flex items-center justify-center transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${label}: ${count} รายการ (${pct.toFixed(1)}%)`}
                  >
                    {pct > 8 && (
                      <span className="text-white text-[10px] font-semibold drop-shadow-sm">
                        {pct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-4">
              {CATEGORY_CONFIGS.map(({ key, barColor, label }) => {
                const count = byCategory?.[key] ?? 0
                if (count === 0) return null
                return (
                  <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${barColor}`} />
                    <span>{label}</span>
                  </div>
                )
              })}
            </div>

            {/* Category rows */}
            <div className="space-y-1.5">
              {CATEGORY_CONFIGS.map(({ key, label, sublabel, icon: Icon, color, bg, border }) => {
                const count = byCategory?.[key] ?? 0
                if (count === 0) return null
                const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0"
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${bg} ${border}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${color}`}>{label}</p>
                      {sublabel && (
                        <p className="text-xs text-muted-foreground">{sublabel}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-base font-bold ${color}`}>{count.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{pct}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* KPI Cards — production completeness */}
          {productionCount > 0 && (
            <div className="bg-background rounded-2xl border border-border p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-blue-600 shrink-0" />
                <p className="text-sm font-semibold text-foreground">
                  ความครบข้อมูลของงาน Production ({productionCount.toLocaleString()} รายการ)
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className={`rounded-xl border p-4 ${completeCount === productionCount ? "bg-green-50 border-green-200" : "bg-background border-border"}`}>
                  <p className="text-xs text-muted-foreground mb-1.5">ครบสมบูรณ์</p>
                  <p className={`text-2xl font-bold ${completeCount === productionCount ? "text-green-700" : "text-foreground"}`}>
                    {completeCount.toLocaleString()}
                    <span className="text-sm font-normal text-muted-foreground ml-1">รายการ</span>
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {completeCount === productionCount
                      ? <CheckCircle className="w-3 h-3 text-green-600" />
                      : <TrendingUp className="w-3 h-3 text-muted-foreground" />}
                    <p className="text-xs text-muted-foreground">
                      {productionCount > 0 ? ((completeCount / productionCount) * 100).toFixed(1) : "0.0"}% ของงาน Production
                    </p>
                  </div>
                </div>

                <div className={`rounded-xl border p-4 ${partialCount > 0 ? "bg-amber-50 border-amber-200" : "bg-background border-border"}`}>
                  <p className="text-xs text-muted-foreground mb-1.5">มีข้อมูลบางส่วน</p>
                  <p className={`text-2xl font-bold ${partialCount > 0 ? "text-amber-700" : "text-green-700"}`}>
                    {partialCount.toLocaleString()}
                    {partialCount === 0 && <span className="text-sm font-normal text-green-600 ml-2">ดีมาก!</span>}
                    {partialCount > 0 && <span className="text-sm font-normal text-muted-foreground ml-1">รายการ</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {productionCount > 0 ? ((partialCount / productionCount) * 100).toFixed(1) : "0.0"}% ของงาน Production
                  </p>
                </div>

                <div className={`rounded-xl border p-4 ${noDataCount > 0 ? "bg-muted border-border" : "bg-background border-border"}`}>
                  <p className="text-xs text-muted-foreground mb-1.5">ยังไม่มีข้อมูลเลย</p>
                  <p className={`text-2xl font-bold ${noDataCount > 0 ? "text-muted-foreground" : "text-green-700"}`}>
                    {noDataCount.toLocaleString()}
                    {noDataCount === 0 && <span className="text-sm font-normal text-green-600 ml-2">ดีมาก!</span>}
                    {noDataCount > 0 && <span className="text-sm font-normal text-muted-foreground ml-1">รายการ</span>}
                  </p>
                  {noDataCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {productionCount > 0 ? ((noDataCount / productionCount) * 100).toFixed(1) : "0.0"}% ของงาน Production
                    </p>
                  )}
                  {noDataCount === 0 && <p className="text-xs text-green-600 mt-1">ไม่มีแผนที่ว่างเปล่า</p>}
                </div>
              </div>

              {/* Pattern stacked bar */}
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium text-foreground mb-1">สัดส่วนความครบของข้อมูล</p>
                <p className="text-xs text-muted-foreground mb-4">
                  <span className="inline-flex items-center gap-1">
                    <FieldDot present={true} /> ราคา
                  </span>
                  {" · "}
                  <span className="inline-flex items-center gap-1">
                    <FieldDot present={true} /> เวลา
                  </span>
                  {" · "}
                  <span className="inline-flex items-center gap-1">
                    <FieldDot present={true} /> ผลผลิต
                  </span>
                </p>
                <PatternBar groups={patternGroups} total={productionCount} />
              </div>

              {/* Pattern rows */}
              <div className="space-y-2">
                {patternGroups
                  .filter((g) => g.count > 0)
                  .map((g, i) => (
                    <PatternRow
                      key={g.pattern}
                      group={g}
                      total={productionCount}
                      index={i}
                      onPreview={() => setPreviewPattern(g.pattern)}
                    />
                  ))}
                <p className="text-xs text-muted-foreground text-right pt-1">
                  รวมทุกกลุ่ม {patternSum.toLocaleString()} / {productionCount.toLocaleString()} รายการ Production
                </p>
              </div>

              {/* Field breakdown */}
              <div className="pt-4 border-t border-border space-y-4">
                {(data.unverifiedConversionCount ?? 0) > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-start gap-2 text-amber-950">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">อัตราแปลงยังไม่ยืนยัน {data.unverifiedConversionCount} รายการ</p>
                        <p className="text-xs text-amber-800/90">
                          yield/ต้นทุนต่อหน่วยอาจคลาดเคลื่อน — ควรตรวจ FG master
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowUnverifiedPreview(true)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-300 text-xs text-amber-900 hover:bg-amber-100 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        ดูรายการ
                      </button>
                      {canManageFg ? (
                        <Link
                          href="/fg-master-settings"
                          className="px-2 py-1 rounded-lg border border-amber-300 text-xs text-amber-900 hover:bg-amber-100 transition-colors"
                        >
                          จัดการ FG
                        </Link>
                      ) : null}
                    </div>
                  </div>
                )}
                <p className="text-sm font-medium text-foreground">ความครบแยกตามประเภทข้อมูล</p>
                <FieldBreakdown byField={data.byField} total={productionCount} />
              </div>
            </div>
          )}
        </>
      )}

      {showPreview && (
        <NonProductionPreviewModal
          from={from}
          to={to}
          onClose={() => setShowPreview(false)}
        />
      )}

      {previewPattern && (
        <ProductionPatternPreviewModal
          from={from}
          to={to}
          pattern={previewPattern}
          onClose={() => setPreviewPattern(null)}
        />
      )}

      {showUnverifiedPreview && (
        <UnverifiedConversionPreviewModal
          from={from}
          to={to}
          onClose={() => setShowUnverifiedPreview(false)}
        />
      )}
    </div>
  )
}
