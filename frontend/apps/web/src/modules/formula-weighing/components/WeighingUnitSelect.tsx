"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { cn } from "@/shared/lib/utils"
import { formulaWeighingApi } from "../services/formula-weighing.api"
import {
  buildSortedWeighingUnits,
  canonicalWeighingUnit,
  getUnitUsageCounts,
  isValidWeighingUnit,
  type UnitUsageCounts,
} from "../utils/weighing-unit-prefs"

interface WeighingUnitSelectProps {
  value: string
  onChange: (value: string) => void
  extraUnits?: string[]
  className?: string
  triggerClassName?: string
  placeholder?: string
}

export function WeighingUnitSelect({
  value,
  onChange,
  extraUnits = [],
  className,
  triggerClassName,
  placeholder = "เลือกหน่วย",
}: WeighingUnitSelectProps) {
  const [serverPopular, setServerPopular] = useState<string[]>([])
  const [usageCounts, setUsageCounts] = useState<UnitUsageCounts>({})

  useEffect(() => {
    setUsageCounts(getUnitUsageCounts())
    formulaWeighingApi
      .getPopularUnits()
      .then(setServerPopular)
      .catch(() => setServerPopular([]))
  }, [])

  const resolvedValue = useMemo(() => {
    const canonical = canonicalWeighingUnit(value)
    if (isValidWeighingUnit(canonical)) return canonical
    const fallback = extraUnits.map(canonicalWeighingUnit).find(isValidWeighingUnit)
    return fallback ?? ""
  }, [value, extraUnits])

  useEffect(() => {
    const canonical = canonicalWeighingUnit(value)
    if (value.trim() && canonical !== value.trim() && resolvedValue) {
      onChange(resolvedValue)
    }
  }, [value, resolvedValue, onChange])

  const options = useMemo(
    () =>
      buildSortedWeighingUnits({
        serverPopular,
        usageCounts,
        extraUnits,
        currentUnit: resolvedValue,
      }),
    [serverPopular, usageCounts, extraUnits, resolvedValue],
  )

  const selectValue = resolvedValue || undefined

  return (
    <div className={className}>
      <Select
        value={selectValue}
        onValueChange={onChange}
        onOpenChange={(open) => {
          if (open) setUsageCounts(getUnitUsageCounts())
        }}
      >
        <SelectTrigger
          className={cn(
            "w-full h-10 md:h-11 text-base md:text-lg justify-center",
            triggerClassName,
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((unit) => (
            <SelectItem key={unit} value={unit}>
              {unit}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
