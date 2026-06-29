"use client"

import { type RefObject } from "react"
import { AlertTriangle } from "lucide-react"
import { Input } from "@/shared/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import {
  isKgUnit,
  type OutputUnitOption,
  type OutputVariant,
} from "../services/production-summary.api"
import { sellableQtyKey } from "../utils/sellable-qty"

interface OutputLinesSectionProps {
  variants: OutputVariant[]
  sellableQtys: Record<string, string>
  useAdminSingleField: boolean
  showAdminUnitPicker: boolean
  unitChoices: OutputUnitOption[]
  baseUnitLabel: string
  conversionVerified: boolean
  weightInputRef?: RefObject<HTMLInputElement | null>
  isLoading: boolean
  hasSellableOutput: boolean
  scrapTouched: boolean
  scrapDisplayValue: string
  onSellableQtyChange: (key: string, value: string) => void
  onAdminUnitChange: (unit: string) => void
  onScrapChange: (value: string) => void
}

export function OutputLinesSection({
  variants,
  sellableQtys,
  useAdminSingleField,
  showAdminUnitPicker,
  unitChoices,
  baseUnitLabel,
  conversionVerified,
  weightInputRef,
  isLoading,
  hasSellableOutput,
  scrapTouched,
  scrapDisplayValue,
  onSellableQtyChange,
  onAdminUnitChange,
  onScrapChange,
}: OutputLinesSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <p className="text-sm md:text-base font-medium text-foreground">ผลิตได้จำนวน:</p>
        {variants.map((variant, index) => {
          const key = sellableQtyKey(variant, index, useAdminSingleField)
          const qty = parseFloat(sellableQtys[key] || "") || 0
          const weightKg = qty > 0 ? qty * variant.conversionRate : 0
          const showUnverifiedHint =
            qty > 0 && !conversionVerified && !isKgUnit(variant.unit)

          return (
            <div key={key} className="space-y-1">
              <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <label className="text-sm font-medium whitespace-nowrap shrink-0">
                    {variant.label}:
                  </label>
                  <Input
                    ref={index === 0 ? weightInputRef : undefined}
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={sellableQtys[key] ?? ""}
                    onChange={(e) => onSellableQtyChange(key, e.target.value)}
                    placeholder="0"
                    className="text-center font-sans flex-1 min-w-0"
                    disabled={isLoading}
                  />
                </div>
                {showAdminUnitPicker ? (
                  <Select
                    value={variant.unit}
                    onValueChange={onAdminUnitChange}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="w-[88px] h-9 font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unitChoices.map((option) => (
                        <SelectItem key={option.unit} value={option.unit}>
                          {option.unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground shrink-0">
                    {variant.unit}
                  </span>
                )}
              </div>
              {variant.packSize && (
                <p className="text-xs text-muted-foreground pl-1">
                  ขนาดมาตรฐาน: {variant.packSize}
                </p>
              )}
              {qty > 0 && (
                <p
                  className={`text-xs pl-1 flex items-center gap-1 ${
                    showUnverifiedHint
                      ? "text-amber-700"
                      : "text-muted-foreground"
                  }`}
                >
                  {showUnverifiedHint && (
                    <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden />
                  )}
                  <span>
                    ≈ {weightKg.toFixed(2)} {baseUnitLabel}
                    {showUnverifiedHint ? " (อัตราแปลงยังไม่ยืนยัน)" : ""}
                  </span>
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium whitespace-nowrap">เศษ:</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={scrapDisplayValue}
            onChange={(e) => onScrapChange(e.target.value)}
            placeholder="0.00"
            className="text-center font-sans flex-1"
            disabled={isLoading || !hasSellableOutput}
          />
        </div>
        <span className="text-sm md:text-base font-medium text-muted-foreground">กก.</span>
      </div>

      {!hasSellableOutput ? (
        <p className="text-xs text-muted-foreground">
          กรอกจำนวนผลิตได้ก่อน ระบบจะคำนวณเศษให้อัตโนมัติ
        </p>
      ) : (
        !scrapTouched && (
          <p className="text-xs text-muted-foreground">
            คำนวณจาก น้ำหนักวัตถุดิบเข้า − น้ำหนักวัตถุดิบที่ได้ (แก้ค่าได้)
          </p>
        )
      )}
    </>
  )
}
