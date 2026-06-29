"use client"

import { useEffect, useState, type FocusEvent } from "react"
import { Button } from "@/shared/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog"
import { Input } from "@/shared/ui/input"
import { NumericQuantityInput } from "@/shared/ui/numeric-quantity-input"
import { FORMULA_WEIGHING_LABELS as L } from "../constants/labels"
import type { FormulaWeighingLine } from "../types"
import { WeighingUnitSelect } from "./WeighingUnitSelect"
import {
  getPlannedUnitFromLine,
  getWithdrawnUnitFromLine,
} from "../utils/weighing-unit-prefs"
import {
  isEmptyWithdrawnQuantity,
  normalizeWithdrawnQuantityForSave,
  sanitizeWithdrawnQuantityInput,
  withdrawnQuantityForInput,
} from "../utils/withdrawn-quantity"
import { formatPlannedQuantityDisplay } from "../utils/planned-quantity-display"
import { formatUnitPriceInput, limitUnitPriceInput, roundUnitPrice } from "../utils/unit-price"
import type { WithdrawInput } from "../hooks/useFormulaWeighing"

interface WithdrawWeightDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  line: FormulaWeighingLine | null
  batchCount: number
  isSaving: boolean
  onSave: (line: FormulaWeighingLine, input: WithdrawInput) => Promise<boolean>
}

export function WithdrawWeightDialog({
  open,
  onOpenChange,
  line,
  batchCount,
  isSaving,
  onSave,
}: WithdrawWeightDialogProps) {
  const [withdrawnQtyInput, setWithdrawnQtyInput] = useState("")
  const [withdrawnUnitInput, setWithdrawnUnitInput] = useState("")
  const [unitPriceInput, setUnitPriceInput] = useState("")
  const [noteInput, setNoteInput] = useState("")
  const [priceEdited, setPriceEdited] = useState(false)

  useEffect(() => {
    if (!open || !line) return
    setWithdrawnQtyInput(withdrawnQuantityForInput(line.withdrawnQuantity))
    setWithdrawnUnitInput(getWithdrawnUnitFromLine(line))
    setUnitPriceInput(
      line.unitPrice != null && Number.isFinite(line.unitPrice)
        ? formatUnitPriceInput(line.unitPrice)
        : "",
    )
    setNoteInput(line.note ?? "")
    setPriceEdited(false)
  }, [open, line])

  const handleWithdrawnQtyFocus = (event: FocusEvent<HTMLInputElement>) => {
    const el = event.target
    if (isEmptyWithdrawnQuantity(el.value)) {
      setWithdrawnQtyInput("")
      return
    }
    el.select()
  }

  const handleSave = async () => {
    if (!line) return
    const success = await onSave(line, {
      withdrawnQtyInput,
      withdrawnUnitInput,
      unitPriceInput,
      noteInput,
      priceEdited,
    })
    if (success) {
      onOpenChange(false)
      setWithdrawnQtyInput("")
      setWithdrawnUnitInput("")
      setUnitPriceInput("")
      setNoteInput("")
      setPriceEdited(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg top-[2%] translate-y-0 max-h-[85vh] overflow-y-auto text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl md:text-2xl text-center text-foreground">
            {L.withdrawDialogTitle}
            <br />
            {L.withdrawDialogSubtitle}
          </DialogTitle>
        </DialogHeader>
        {line && (
          <div className="space-y-4 md:space-y-5 py-4 md:py-5">
            <div className="space-y-2 md:space-y-3">
              <p className="text-base md:text-lg font-semibold text-foreground">
                <span className="text-muted-foreground">{L.columns.productCode}:</span>{" "}
                {line.productCode} - {line.productName}
              </p>
              {(line.plannedQuantity ?? "").trim() ? (
                (() => {
                  const plannedDisplay = formatPlannedQuantityDisplay({
                    total: line.plannedQuantity,
                    base: line.baseQuantity,
                    unit: getPlannedUnitFromLine(line),
                    batchCount,
                    isManual: line.isManual,
                  })
                  return (
                    <div className="text-foreground text-base md:text-lg font-medium">
                      <p>
                        {L.plannedQuantityHint}: {plannedDisplay.main}
                      </p>
                      {plannedDisplay.sub ? (
                        <p className="text-sm text-muted-foreground font-normal mt-0.5">
                          ({plannedDisplay.sub})
                        </p>
                      ) : null}
                    </div>
                  )
                })()
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <label className="text-sm md:text-base font-medium text-foreground">
                  {L.fieldWithdrawnQuantity}
                </label>
                <NumericQuantityInput
                  value={withdrawnQtyInput}
                  onChange={(e) =>
                    setWithdrawnQtyInput(sanitizeWithdrawnQuantityInput(e.target.value))
                  }
                  onFocus={handleWithdrawnQtyFocus}
                  className="text-lg md:text-xl text-center focus-visible:border-red-800 focus-visible:ring-red-800/50"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm md:text-base font-medium text-foreground">
                  {L.fieldWithdrawnUnit}
                </label>
                <WeighingUnitSelect
                  value={withdrawnUnitInput}
                  onChange={setWithdrawnUnitInput}
                  extraUnits={[
                    getWithdrawnUnitFromLine(line),
                    getPlannedUnitFromLine(line),
                  ].filter(Boolean)}
                  triggerClassName="text-lg md:text-xl focus-visible:border-red-800 focus-visible:ring-red-800/50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm md:text-base font-medium text-foreground">
                {L.fieldUnitPrice}
              </label>
              <NumericQuantityInput
                value={unitPriceInput}
                onChange={(e) => {
                  setUnitPriceInput(limitUnitPriceInput(e.target.value.replace(/[^\d.,]/g, "")))
                  setPriceEdited(true)
                }}
                onBlur={(e) => {
                  const raw = e.target.value.replace(/,/g, "")
                  if (raw === "") return
                  const parsed = Number.parseFloat(raw)
                  if (Number.isFinite(parsed)) {
                    setUnitPriceInput(formatUnitPriceInput(parsed))
                  }
                }}
                className="text-lg md:text-xl text-center focus-visible:border-red-800 focus-visible:ring-red-800/50"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm md:text-base font-medium text-foreground">
                {L.fieldNote}
              </label>
              <Input
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                maxLength={500}
                className="text-base md:text-lg"
              />
            </div>
          </div>
        )}
        <div className="flex gap-3 md:gap-4 justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-w-28 md:min-w-32 h-11 md:h-12 text-base md:text-lg bg-black hover:bg-black/90 text-white"
          >
            {L.cancel}
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              isSaving ||
              !normalizeWithdrawnQuantityForSave(withdrawnQtyInput) ||
              !withdrawnUnitInput.trim()
            }
            className="min-w-28 md:min-w-32 h-11 md:h-12 text-base md:text-lg bg-black hover:bg-black/90 text-white"
          >
            {isSaving ? "กำลังบันทึก..." : L.save}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
