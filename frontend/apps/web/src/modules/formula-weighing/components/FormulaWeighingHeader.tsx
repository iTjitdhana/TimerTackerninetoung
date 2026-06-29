"use client"

import { FORMULA_WEIGHING_LABELS as L } from "../constants/labels"

const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
]

function getDateDay(dateString: string) {
  const day = Number(dateString.split("-")[2])
  return Number.isNaN(day) ? new Date().getDate() : day
}

function getDateMonthShort(dateString: string) {
  const month = Number(dateString.split("-")[1])
  return THAI_MONTHS_SHORT[month - 1] ?? ""
}

interface FormulaWeighingHeaderProps {
  date: string
  onDateChange: (value: string) => void
  productionLine: string
  productCode: string | null
}

export function FormulaWeighingHeader({
  date,
  onDateChange,
  productionLine,
  productCode,
}: FormulaWeighingHeaderProps) {
  return (
    <div className="flex gap-2 md:gap-3 lg:gap-4 items-center">
      <div className="relative">
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
        />
        <div className="flex flex-col items-center justify-center w-10 h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 border border-border/60 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
          <span className="text-base md:text-lg lg:text-xl font-bold leading-none text-foreground font-sans">
            {getDateDay(date)}
          </span>
          <span className="text-[8px] md:text-[9px] lg:text-[10px] leading-none text-muted-foreground uppercase">
            {getDateMonthShort(date)}
          </span>
        </div>
      </div>
      <div className="flex-1">
        <p className="text-lg font-bold truncate">{productionLine}</p>
        {productCode ? (
          <p className="text-xs text-muted-foreground">
            {L.columns.productCode}: {productCode}
          </p>
        ) : null}
      </div>
    </div>
  )
}
