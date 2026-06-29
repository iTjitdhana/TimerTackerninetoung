"use client"

import { useState } from "react"
import { formatPlannedQuantityDisplay } from "@/modules/formula-weighing/utils/planned-quantity-display"
import {
  formatWithdrawnQuantityDisplay,
  normalizeWithdrawnQuantityForSave,
  sanitizeWithdrawnQuantityInput,
  withdrawnQuantityForInput,
} from "@/modules/formula-weighing/utils/withdrawn-quantity"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import type { TimerIngredient } from "../types"

interface IngredientsPanelProps {
  ingredients: TimerIngredient[]
  batchCount?: number
  onSaveOperatorWeighing?: (
    materialCode: string,
    measuredWeight: string,
    unitPrice?: number,
  ) => Promise<void>
  isSaving?: boolean
}

function splitIngredients(ingredients: TimerIngredient[]) {
  const formulaWeighed = ingredients.filter(
    (item) => item.editableOnTimer !== true,
  )
  const operatorTasks = ingredients.filter(
    (item) => item.editableOnTimer === true,
  )
  return { formulaWeighed, operatorTasks }
}

function formatUnitPrice(value?: number): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return value.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function unitPriceForInput(value?: number): string {
  if (value == null || !Number.isFinite(value)) return ""
  return String(value)
}

function normalizeUnitPriceForSave(value: string): number | undefined {
  const trimmed = value.trim().replace(/,/g, "")
  if (!trimmed) return undefined
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return parsed
}

function sanitizeUnitPriceInput(value: string): string {
  return value.replace(/[^\d.,]/g, "")
}

function FormulaWeighedTable({ items }: { items: TimerIngredient[] }) {
  if (items.length === 0) return null

  return (
    <section>
      <h3 className="px-3 py-2 md:px-5 md:py-3 text-sm md:text-base font-semibold bg-muted/50 border-b border-border/30">
        เจ้าหน้าที่ตวงสูตรตวงแล้ว
      </h3>

      {/* Mobile: card layout */}
      <div className="md:hidden divide-y divide-border/10">
        {items.map((ingredient) => {
          const displayWeight = formatWithdrawnQuantityDisplay(ingredient.actualWeight)
          return (
            <div key={ingredient.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm leading-snug">{ingredient.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{ingredient.code}</p>
              </div>
              <div className="text-right shrink-0">
                {displayWeight ? (
                  <p className="font-semibold text-sm text-success font-sans">
                    {displayWeight}{" "}
                    <span className="font-normal text-muted-foreground text-xs">{ingredient.unit}</span>
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">—</p>
                )}
                <p className="text-xs text-muted-foreground font-sans mt-0.5">
                  {formatUnitPrice(ingredient.unitPrice)} บาท/หน่วย
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tablet/Desktop: 3-column table */}
      <table className="hidden md:table w-full border-collapse">
        <thead>
          <tr className="border-b border-border/20 text-muted-foreground text-sm">
            <th className="px-5 py-3 text-left font-medium">วัตถุดิบ</th>
            <th className="px-5 py-3 text-right font-medium">จำนวนเบิก</th>
            <th className="px-5 py-3 text-right font-medium">ราคา/หน่วย</th>
          </tr>
        </thead>
        <tbody>
          {items.map((ingredient) => {
            const displayWeight = formatWithdrawnQuantityDisplay(ingredient.actualWeight)
            return (
              <tr key={ingredient.id} className="border-b border-border/10 last:border-0 hover:bg-muted/20">
                <td className="px-5 py-3">
                  <p className="font-semibold text-base">{ingredient.name}</p>
                  <p className="text-sm text-muted-foreground">{ingredient.code}</p>
                </td>
                <td className="px-5 py-3 text-right font-sans whitespace-nowrap">
                  {displayWeight ? (
                    <span className="font-bold text-success text-base">
                      {displayWeight}{" "}
                      <span className="font-normal text-muted-foreground text-sm">{ingredient.unit}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-base">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right font-sans whitespace-nowrap text-muted-foreground text-sm">
                  {formatUnitPrice(ingredient.unitPrice)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function OperatorWeighingSection({
  items,
  batchCount,
  isSaving,
  savingCode,
  drafts,
  priceDrafts,
  onDraftChange,
  onPriceDraftChange,
  onSave,
}: {
  items: TimerIngredient[]
  batchCount: number
  isSaving: boolean
  savingCode: string | null
  drafts: Record<string, string>
  priceDrafts: Record<string, string>
  onDraftChange: (code: string, value: string) => void
  onPriceDraftChange: (code: string, value: string) => void
  onSave: (ingredient: TimerIngredient) => void
}) {
  if (items.length === 0) return null

  return (
    <section className="border-t border-border/30">
      <h3 className="px-3 py-2 md:px-5 md:py-3 text-sm md:text-base font-semibold bg-amber-50 text-amber-950 border-b border-amber-200/80">
        ผู้ผลิตต้องตวงก่อนเริ่มผลิต
      </h3>
      <div className="divide-y divide-border/10">
        {items.map((ingredient) => {
          const draftValue =
            drafts[ingredient.code] !== undefined
              ? drafts[ingredient.code]
              : withdrawnQuantityForInput(ingredient.actualWeight)
          const priceDraftValue =
            priceDrafts[ingredient.code] !== undefined
              ? priceDrafts[ingredient.code]
              : unitPriceForInput(ingredient.unitPrice)
          const displayWeight = formatWithdrawnQuantityDisplay(
            ingredient.actualWeight,
          )
          const normalizedDraft = normalizeWithdrawnQuantityForSave(draftValue)
          const normalizedPriceDraft = normalizeUnitPriceForSave(priceDraftValue)
          const savedPrice = ingredient.unitPrice
          const hasChanges =
            normalizedDraft !== "" &&
            (normalizedDraft !== (displayWeight || "") ||
              (normalizedPriceDraft != null &&
                normalizedPriceDraft !== (savedPrice ?? undefined)))
          const plannedDisplay = ingredient.quantity.trim()
            ? formatPlannedQuantityDisplay({
                total: ingredient.quantity,
                base: ingredient.baseQuantity,
                unit: ingredient.plannedUnit || ingredient.unit,
                batchCount,
                isManual: !ingredient.baseQuantity?.trim(),
              })
            : null

          return (
            <div key={ingredient.id} className="px-3 py-3 md:px-5 md:py-4 space-y-2 md:space-y-3 border-b border-border/10 last:border-0">
              {/* ชื่อ + สูตร */}
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <p className="font-semibold text-sm md:text-base leading-snug truncate">{ingredient.name}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">{ingredient.code}</p>
                </div>
                {plannedDisplay && (
                  <p className="text-xs md:text-sm text-right text-muted-foreground shrink-0">
                    ตามสูตร{" "}
                    <span className="font-semibold text-foreground">{plannedDisplay.main}</span>
                    {plannedDisplay.sub && (
                      <span className="block text-[10px] md:text-xs">({plannedDisplay.sub})</span>
                    )}
                  </p>
                )}
              </div>

              {/* Inputs + บันทึก — แถวเดียวทุก breakpoint */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={draftValue}
                    onChange={(event) =>
                      onDraftChange(
                        ingredient.code,
                        sanitizeWithdrawnQuantityInput(event.target.value),
                      )
                    }
                    placeholder="จำนวน"
                    className="h-9 md:h-11 flex-1 min-w-0 text-center font-sans text-sm md:text-base"
                    disabled={isSaving || savingCode === ingredient.code}
                    aria-label={`จำนวนเบิก ${ingredient.name}`}
                  />
                  <span className="text-xs md:text-sm text-muted-foreground shrink-0 w-6 md:w-8">{ingredient.unit}</span>
                </div>
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={priceDraftValue}
                    onChange={(event) =>
                      onPriceDraftChange(
                        ingredient.code,
                        sanitizeUnitPriceInput(event.target.value),
                      )
                    }
                    placeholder="ราคา/หน่วย"
                    className="h-9 md:h-11 flex-1 min-w-0 text-center font-sans text-sm md:text-base"
                    disabled={isSaving || savingCode === ingredient.code}
                    aria-label={`ราคาต่อหน่วย ${ingredient.name}`}
                  />
                  <span className="text-xs md:text-sm text-muted-foreground shrink-0">บาท</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={hasChanges ? "default" : "outline"}
                  className="h-9 md:h-11 px-3 md:px-5 shrink-0 text-xs md:text-sm"
                  disabled={!hasChanges || isSaving || savingCode === ingredient.code}
                  onClick={() => onSave(ingredient)}
                >
                  {savingCode === ingredient.code ? "..." : "บันทึก"}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function IngredientsPanel({
  ingredients,
  batchCount = 1,
  onSaveOperatorWeighing,
  isSaving = false,
}: IngredientsPanelProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [savingCode, setSavingCode] = useState<string | null>(null)

  if (ingredients.length === 0) {
    return null
  }

  const { formulaWeighed, operatorTasks } = splitIngredients(ingredients)

  const handleSave = async (ingredient: TimerIngredient) => {
    if (!onSaveOperatorWeighing) return

    const draftValue =
      drafts[ingredient.code] !== undefined
        ? drafts[ingredient.code]
        : withdrawnQuantityForInput(ingredient.actualWeight)
    const priceDraftValue =
      priceDrafts[ingredient.code] !== undefined
        ? priceDrafts[ingredient.code]
        : unitPriceForInput(ingredient.unitPrice)
    const measuredWeight = normalizeWithdrawnQuantityForSave(draftValue)
    if (!measuredWeight) return
    const unitPrice = normalizeUnitPriceForSave(priceDraftValue)

    setSavingCode(ingredient.code)
    try {
      await onSaveOperatorWeighing(ingredient.code, measuredWeight, unitPrice)
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[ingredient.code]
        return next
      })
      setPriceDrafts((prev) => {
        const next = { ...prev }
        delete next[ingredient.code]
        return next
      })
    } catch {
      // error toast แสดงจาก saveOperatorWeighing แล้ว — คง draft ไว้ให้ผู้ใช้ลองใหม่
    } finally {
      setSavingCode(null)
    }
  }

  return (
    <div className="mt-2 border border-red-600 rounded-xl overflow-hidden bg-background">
      <FormulaWeighedTable items={formulaWeighed} />
      <OperatorWeighingSection
        items={operatorTasks}
        batchCount={batchCount}
        isSaving={isSaving}
        savingCode={savingCode}
        drafts={drafts}
        priceDrafts={priceDrafts}
        onDraftChange={(code, value) =>
          setDrafts((prev) => ({ ...prev, [code]: value }))
        }
        onPriceDraftChange={(code, value) =>
          setPriceDrafts((prev) => ({ ...prev, [code]: value }))
        }
        onSave={(ingredient) => void handleSave(ingredient)}
      />
    </div>
  )
}

export { splitIngredients }
