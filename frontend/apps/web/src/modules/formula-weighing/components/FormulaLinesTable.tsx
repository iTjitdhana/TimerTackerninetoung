"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { FORMULA_WEIGHING_LABELS as L } from "../constants/labels"
import type { FormulaWeighingLine } from "../types"
import {
  getPlannedUnitFromLine,
  getWithdrawnUnitFromLine,
} from "../utils/weighing-unit-prefs"
import { formatWithdrawnQuantityDisplay } from "../utils/withdrawn-quantity"
import { formatPlannedQuantityDisplay } from "../utils/planned-quantity-display"
import {
  formatUnitPriceDisplay,
  formatUnitPriceInput,
  limitUnitPriceInput,
  roundUnitPrice,
} from "../utils/unit-price"
import { formatPriceSourceLabel, nowIso } from "../utils/price-source-label"
import { WeighingUnitSelect } from "./WeighingUnitSelect"

function PriceSourceHint({
  source,
  at,
}: {
  source: "api" | "manual"
  at?: string
}) {
  return (
    <span className="text-[10px] text-muted-foreground leading-tight">
      {formatPriceSourceLabel(source, at)}
    </span>
  )
}

interface FormulaLinesTableProps {
  lines: FormulaWeighingLine[]
  batchCount: number
  canWrite: boolean
  /** แสดง label ที่มาของราคา (admin-only) */
  isAdmin: boolean
  /** Mobile/iPad: เปิด dialog */
  onOpenWithdraw: (line: FormulaWeighingLine) => void
  onRemoveLine: (line: FormulaWeighingLine) => void
  /** อัปเดต note (ทุก device — state เท่านั้น, save ตอนกดบันทึก) */
  onNoteChange: (lineId: string, note: string) => void
  /** PC inline: อัปเดต field — state เท่านั้น */
  onInlineChange: (
    lineId: string,
    fields: Partial<Pick<FormulaWeighingLine, "withdrawnQuantity" | "withdrawnUnit" | "unitPrice" | "unitPriceSource" | "unitPriceSourceAt">>,
  ) => void
}

export function FormulaLinesTable({
  lines,
  batchCount,
  canWrite,
  isAdmin,
  onOpenWithdraw,
  onRemoveLine,
  onNoteChange,
  onInlineChange,
}: FormulaLinesTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs md:text-sm lg:text-base">
        <thead>
          <tr className="border-b border-border/40 bg-muted/30">
            <th className="p-2 md:p-3 text-left font-semibold whitespace-nowrap">
              {L.columns.productCode}
            </th>
            <th className="p-2 md:p-3 text-left font-semibold">{L.columns.productName}</th>
            <th className="p-2 md:p-3 text-center font-semibold whitespace-nowrap">
              {L.columns.plannedQuantity}
            </th>
            {/* จำนวนเบิก: PC = inline input header, Mobile = display header */}
            <th className="p-2 md:p-3 text-center font-semibold whitespace-nowrap">
              {L.columns.withdrawnQuantity}
            </th>
            {/* หน่วยเบิก — แสดงเฉพาะ PC */}
            <th className="hidden lg:table-cell p-2 md:p-3 text-center font-semibold whitespace-nowrap">
              {L.fieldWithdrawnUnit}
            </th>
            <th className="p-2 md:p-3 text-center font-semibold whitespace-nowrap">
              {L.columns.unitPrice}
            </th>
            {/* หมายเหตุ — PC เท่านั้น (Mobile อยู่ใน dialog) */}
            <th className="hidden lg:table-cell p-2 md:p-3 text-left font-semibold min-w-[9rem]">
              {L.columns.note}
            </th>
            {/* action column */}
            <th className="p-2 md:p-3 text-center font-semibold w-10 md:w-14 lg:w-10" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const withdrawnDisplay = formatWithdrawnQuantityDisplay(line.withdrawnQuantity)
            const plannedDisplay = (line.plannedQuantity ?? "").trim()
              ? formatPlannedQuantityDisplay({
                  total: line.plannedQuantity,
                  base: line.baseQuantity,
                  unit: getPlannedUnitFromLine(line),
                  batchCount,
                  isManual: line.isManual,
                })
              : null

            return (
              <tr key={line.id} className="border-b border-border/30 hover:bg-muted/20">
                {/* รหัสสินค้า */}
                <td className="p-2 md:p-3 font-sans text-sm md:text-base text-muted-foreground whitespace-nowrap align-middle">
                  {line.productCode}
                </td>

                {/* ชื่อสินค้า */}
                <td className="p-2 md:p-3 text-base align-middle">
                  <p>{line.productName}</p>
                  {line.isManual ? (
                    <p className="text-xs text-muted-foreground mt-0.5">{L.manualBadge}</p>
                  ) : null}
                </td>

                {/* จำนวนตามสูตร */}
                <td className="p-2 md:p-3 text-center font-sans whitespace-nowrap align-middle">
                  {plannedDisplay ? (
                    <div className="inline-flex flex-col items-center gap-0.5">
                      <span className="font-semibold text-foreground">{plannedDisplay.main}</span>
                      {plannedDisplay.sub ? (
                        <span className="text-xs text-muted-foreground">{plannedDisplay.sub}</span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                {/* จำนวนเบิก */}
                <td className="p-2 md:p-3 font-sans align-middle">
                  {/* Mobile/iPad: แสดงค่า */}
                  <div className="lg:hidden text-center whitespace-nowrap">
                    {withdrawnDisplay ? (
                      <span className="font-semibold text-success">
                        {withdrawnDisplay}
                        {getWithdrawnUnitFromLine(line) ? (
                          <span className="ml-1 font-normal text-muted-foreground">
                            {getWithdrawnUnitFromLine(line)}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="font-semibold text-muted-foreground text-base">
                        —
                        {getWithdrawnUnitFromLine(line) ? (
                          <span className="ml-1 font-normal">{getWithdrawnUnitFromLine(line)}</span>
                        ) : null}
                      </span>
                    )}
                  </div>
                  {/* PC: inline input */}
                  {canWrite ? (
                    <Input
                      value={line.withdrawnQuantity}
                      onChange={(e) =>
                        onInlineChange(line.id, { withdrawnQuantity: e.target.value })
                      }
                      className="hidden lg:flex h-8 text-sm text-center w-24"
                      inputMode="decimal"
                    />
                  ) : (
                    <div className="hidden lg:block text-center">
                      {withdrawnDisplay ?? <span className="text-muted-foreground">—</span>}
                    </div>
                  )}
                </td>

                {/* หน่วยเบิก — PC เท่านั้น */}
                <td className="hidden lg:table-cell p-2 md:p-3 align-middle">
                  {canWrite ? (
                    <WeighingUnitSelect
                      value={line.withdrawnUnit}
                      onChange={(val) => onInlineChange(line.id, { withdrawnUnit: val })}
                      extraUnits={[getWithdrawnUnitFromLine(line), getPlannedUnitFromLine(line)].filter(Boolean)}
                      triggerClassName="h-8 text-xs min-w-[5rem]"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {line.withdrawnUnit || "—"}
                    </span>
                  )}
                </td>

                {/* ราคา/หน่วย */}
                <td className="p-2 md:p-3 font-sans align-middle">
                  {/* Mobile/iPad: แสดงค่า */}
                  <div className="lg:hidden inline-flex flex-col items-center gap-0.5 w-full text-center text-muted-foreground">
                    {line.unitPriceStatus === "no_data" ? (
                      <span>—</span>
                    ) : line.unitPrice != null && Number.isFinite(line.unitPrice) ? (
                      <span>{formatUnitPriceDisplay(line.unitPrice)}</span>
                    ) : (
                      <span>—</span>
                    )}
                    {line.unitPriceStatus === "fallback" || line.unitPriceStatus === "default" ? (
                      <span
                        className="text-[10px] text-amber-600"
                        title={line.unitPriceFallbackReason ?? undefined}
                      >
                        {line.unitPriceStatus === "default"
                          ? L.unitPriceStatus.default
                          : L.unitPriceStatus.fallback}
                      </span>
                    ) : null}
                    {line.unitPriceStatus === "no_data" ? (
                      <span className="text-[10px] text-destructive">{L.unitPriceStatus.noData}</span>
                    ) : null}
                    {/* label ที่มาราคา (admin, mobile) */}
                    {isAdmin && line.unitPriceSource ? (
                      <PriceSourceHint
                        source={line.unitPriceSource}
                        at={line.unitPriceSourceAt}
                      />
                    ) : null}
                  </div>
                  {/* PC: inline input + label */}
                  <div className="hidden lg:flex flex-col items-start gap-1">
                    {canWrite ? (
                      <Input
                        value={
                          line.unitPrice != null && Number.isFinite(line.unitPrice)
                            ? formatUnitPriceInput(line.unitPrice)
                            : ""
                        }
                        onChange={(e) => {
                          const limited = limitUnitPriceInput(e.target.value.replace(/[^\d.,]/g, ""))
                          const parsed = Number.parseFloat(limited.replace(/,/g, ""))
                          onInlineChange(line.id, {
                            unitPrice:
                              limited === ""
                                ? undefined
                                : Number.isFinite(parsed)
                                  ? parsed
                                  : line.unitPrice,
                            unitPriceSource: "manual",
                            unitPriceSourceAt: nowIso(),
                          })
                        }}
                        onBlur={(e) => {
                          const raw = e.target.value.replace(/,/g, "")
                          if (raw === "") return
                          const parsed = Number.parseFloat(raw)
                          if (Number.isFinite(parsed)) {
                            onInlineChange(line.id, {
                              unitPrice: roundUnitPrice(parsed),
                              unitPriceSource: "manual",
                              unitPriceSourceAt: nowIso(),
                            })
                          }
                        }}
                        className="h-8 text-sm text-center w-24"
                        inputMode="decimal"
                        placeholder="0.00"
                      />
                    ) : (
                      <span className="text-muted-foreground">
                        {formatUnitPriceDisplay(line.unitPrice)}
                      </span>
                    )}
                    {line.unitPriceStatus === "fallback" || line.unitPriceStatus === "default" ? (
                      <span className="text-[10px] text-amber-600" title={line.unitPriceFallbackReason ?? undefined}>
                        {line.unitPriceStatus === "default"
                          ? L.unitPriceStatus.default
                          : L.unitPriceStatus.fallback}
                      </span>
                    ) : null}
                    {/* label ที่มาราคา (admin, PC) */}
                    {isAdmin && line.unitPriceSource ? (
                      <PriceSourceHint
                        source={line.unitPriceSource}
                        at={line.unitPriceSourceAt}
                      />
                    ) : null}
                  </div>
                </td>

                {/* หมายเหตุ — PC เท่านั้น */}
                <td className="hidden lg:table-cell p-2 md:p-3 align-middle">
                  {canWrite ? (
                    <Input
                      value={line.note ?? ""}
                      onChange={(e) => onNoteChange(line.id, e.target.value)}
                      maxLength={500}
                      className="h-8 text-sm"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                      {line.note?.trim() ? line.note : "—"}
                    </p>
                  )}
                </td>

                {/* action */}
                <td className="p-2 md:p-3 text-center align-middle">
                  <div className="inline-flex items-center gap-1">
                    {/* ปุ่ม + เฉพาะ Mobile/iPad */}
                    {canWrite ? (
                      <Button
                        size="sm"
                        onClick={() => onOpenWithdraw(line)}
                        className="lg:hidden h-7 w-7 p-0 bg-red-800 hover:bg-red-900 text-white border-0 rounded-full"
                        aria-label={`บันทึกจำนวนเบิก ${line.productName}`}
                      >
                        <span className="text-base leading-none">+</span>
                      </Button>
                    ) : null}
                    {/* ปุ่มลบ (manual เท่านั้น) */}
                    {line.isManual && canWrite ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onRemoveLine(line)}
                        className="h-7 w-7 p-0 border-destructive/40 text-destructive hover:bg-destructive/10"
                        aria-label={`ลบ ${line.productName}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
