"use client"

import { CheckCircle2 } from "lucide-react"
import {
  aggregateOutputLines,
  buildOutputLinesFromFormState,
  type OutputVariant,
} from "../services/production-summary.api"
import { sellableQtyKey } from "../utils/sellable-qty"

interface SavedSummaryDisplayProps {
  variants: OutputVariant[]
  sellableQtys: Record<string, string>
  scrapDisplayValue: string
  baseUnitLabel: string
  useAdminSingleField: boolean
}

export function SavedSummaryDisplay({
  variants,
  sellableQtys,
  scrapDisplayValue,
  baseUnitLabel,
  useAdminSingleField,
}: SavedSummaryDisplayProps) {
  const outputLines = buildOutputLinesFromFormState({
    variants,
    sellableQtys,
    scrapQty: scrapDisplayValue,
    scrapTouched: true,
    inputMaterialKg: 0,
    resolveSellableQtyKey: useAdminSingleField
      ? (variant, index) => sellableQtyKey(variant, index, true)
      : undefined,
  })
  const aggregated = aggregateOutputLines(outputLines)
  const sellableLines = outputLines.filter((line) => line.kind === "sellable")
  const scrapLine = outputLines.find((line) => line.kind === "scrap")

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-green-700">
        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
        <span className="font-medium">บันทึกผลผลิตแล้ว</span>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
        <p className="text-sm font-medium text-foreground">ผลิตได้จำนวน:</p>
        {sellableLines.length > 0 ? (
          sellableLines.map((line) => {
            const weightKg = line.qty * line.conversionRate
            return (
              <div
                key={`${line.label}-${line.unit}`}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="text-muted-foreground">{line.label}:</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {line.qty.toLocaleString("th-TH")} {line.unit}
                  {weightKg > 0 && !line.unit.includes("กก") ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (≈ {weightKg.toFixed(2)} {baseUnitLabel})
                    </span>
                  ) : null}
                </span>
              </div>
            )
          })
        ) : (
          <p className="text-sm text-muted-foreground">ไม่มีจำนวนผลิตได้</p>
        )}

        <div className="flex items-baseline justify-between gap-3 text-sm border-t border-border/60 pt-2">
          <span className="text-muted-foreground">เศษ:</span>
          <span className="font-semibold tabular-nums text-foreground">
            {(scrapLine?.qty ?? aggregated.scrapKg).toLocaleString("th-TH", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}{" "}
            กก.
          </span>
        </div>
      </div>
    </div>
  )
}
