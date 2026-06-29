"use client"

import { useEffect, useState } from "react"
import { businessUnitsApi, type BusinessUnit } from "@/shared/api-client/services"
import {
  DEFAULT_BU_ID,
  getStoredBuFilter,
  setStoredBuFilter,
  type SelectedBuFilter,
} from "@/shared/lib/bu-selection"
import { cn } from "@/shared/lib/utils"

interface BuSelectorProps {
  value: SelectedBuFilter
  onChange: (value: SelectedBuFilter) => void
  className?: string
}

export function BuSelector({ value, onChange, className }: BuSelectorProps) {
  const [units, setUnits] = useState<BusinessUnit[]>([])

  useEffect(() => {
    businessUnitsApi
      .list()
      .then(setUnits)
      .catch(() => setUnits([]))
  }, [])

  const options: Array<{ value: SelectedBuFilter; label: string }> = [
    ...units.map((unit) => ({
      value: unit.id as SelectedBuFilter,
      label: unit.name,
    })),
    { value: "all", label: "ทั้งหมด" },
  ]

  if (options.length === 0) {
    options.push({ value: DEFAULT_BU_ID, label: "BNL" })
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const isSelected = value === option.value
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => {
              setStoredBuFilter(option.value)
              onChange(option.value)
            }}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-all",
              isSelected
                ? "border-blue-500 bg-blue-500 text-white shadow-sm"
                : "border-border/60 bg-white text-foreground hover:border-blue-300 hover:bg-blue-50/60",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function useSelectedBuFilter() {
  const [selectedBu, setSelectedBu] = useState<SelectedBuFilter>(DEFAULT_BU_ID)

  useEffect(() => {
    setSelectedBu(getStoredBuFilter())
  }, [])

  return [selectedBu, setSelectedBu] as const
}
