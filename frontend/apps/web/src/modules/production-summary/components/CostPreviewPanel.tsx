"use client"

import { Input } from "@/shared/ui/input"
import {
  formatMinutesAsThaiDuration,
  type CostPreview,
  type MultiOutputCostBreakdown,
  type ProductionBalance,
} from "../services/production-summary.api"

function formatMoney(value: number): string {
  return value.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-"
  return `${value.toFixed(1)}%`
}

function SummaryMetric({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-md px-2.5 py-2 ${
        highlight ? "bg-green-950/5 border border-green-950/15" : "bg-muted/40"
      }`}
    >
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      <p
        className={`text-sm tabular-nums leading-snug mt-0.5 ${
          highlight ? "font-bold text-green-950" : "font-semibold text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span
        className={`tabular-nums text-right ${bold ? "font-semibold text-foreground" : "font-medium text-foreground"}`}
      >
        {value}
      </span>
    </div>
  )
}

interface CostPreviewPanelProps {
  visible: boolean
  balance: ProductionBalance
  yieldPercent: number | null
  costPreview: CostPreview | null
  materialCost: number
  dailyWageInput: string
  onDailyWageChange: (value: string) => void
  isLoading: boolean
  dailyWagePerPerson: number
  hourlyRate: number
  calculatedLaborCost: number
  totalCost: number
  costBreakdown: MultiOutputCostBreakdown | null
  baseUnitLabel: string
  conversionVerified: boolean
  dailyWageReadOnly?: boolean
}

export function CostPreviewPanel({
  visible,
  balance,
  yieldPercent,
  costPreview,
  materialCost,
  dailyWageInput,
  onDailyWageChange,
  isLoading,
  dailyWagePerPerson,
  hourlyRate,
  calculatedLaborCost,
  totalCost,
  costBreakdown,
  baseUnitLabel,
  conversionVerified,
  dailyWageReadOnly = false,
}: CostPreviewPanelProps) {
  if (!visible) return null

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <div className="px-3 py-2 bg-muted/30 border-b border-border/40">
        <p className="text-xs font-semibold text-foreground tracking-wide">สรุปต้นทุน</p>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <SummaryMetric
            label="น้ำหนักวัตถุดิบเข้า"
            value={`${balance.totalInput.toFixed(2)} กก.`}
          />
          <SummaryMetric
            label="น้ำหนักวัตถุดิบที่ได้"
            value={`${balance.weightKg.toFixed(2)} กก.`}
          />
          <SummaryMetric label="เศษ" value={`${balance.scrap.toFixed(2)} กก.`} />
          <SummaryMetric
            label="% Yield"
            value={formatPercent(yieldPercent)}
            highlight
          />
        </div>

        {!conversionVerified && (
          <p className="text-xs text-amber-700 leading-snug">
            อัตราแปลงยังไม่ยืนยัน — % Yield และต้นทุนต่อหน่วยอาจคลาดเคลื่อน
          </p>
        )}

        {costPreview && (
          <>
            <div className="space-y-1.5 pt-0.5">
              <SummaryRow
                label="ต้นทุนวัตถุดิบ"
                value={`${formatMoney(materialCost)} บาท`}
              />

              <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-2.5 py-2 space-y-1.5">
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">
                    ค่าแรงทั้งวัน/คน
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={dailyWageInput}
                    onChange={(e) => onDailyWageChange(e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-center font-sans"
                    disabled={isLoading || dailyWageReadOnly}
                    readOnly={dailyWageReadOnly}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    บาท
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  อ้างอิงจากข้อมูลผลิต เวลา{" "}
                  {formatMinutesAsThaiDuration(costPreview.timeUsedMinutes)}
                  , ผู้ปฏิบัติงาน {costPreview.operatorsCount} คน
                  {dailyWagePerPerson > 0 && hourlyRate > 0
                    ? ` ค่าแรง ≈ ${hourlyRate.toFixed(2)} บาท/ชม.`
                    : ""}
                </p>
              </div>

              <SummaryRow
                label="ต้นทุนแรงงาน"
                value={`${formatMoney(calculatedLaborCost)} บาท`}
              />
            </div>

            <div className="rounded-md border border-green-950/20 bg-green-950/[0.04] px-3 py-2.5 space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-foreground">ต้นทุนรวม</span>
                <span className="text-base font-bold tabular-nums text-green-950">
                  {formatMoney(totalCost)} บาท
                </span>
              </div>

              {costBreakdown?.costPerSellableKg != null && (
                <div className="space-y-1.5 pt-2 border-t border-green-950/10">
                  <SummaryRow
                    label={`ต้นทุนต่อ ${baseUnitLabel}`}
                    value={`${formatMoney(costBreakdown.costPerSellableKg)} บาท`}
                    bold
                  />
                  {costBreakdown.sellableLineCosts.map((line) => (
                    <SummaryRow
                      key={`${line.label}-${line.unit}`}
                      label={`ต้นทุนต่อ${line.label}`}
                      value={
                        line.costPerUnit != null
                          ? `${formatMoney(line.costPerUnit)} บาท/${line.unit}`
                          : "-"
                      }
                    />
                  ))}
                  {balance.scrap > 0 && (
                    <SummaryRow
                      label={`ต้นทุนเศษ (${balance.scrap.toFixed(2)} ${baseUnitLabel})`}
                      value={`${formatMoney(costBreakdown.scrapCost)} บาท`}
                    />
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
