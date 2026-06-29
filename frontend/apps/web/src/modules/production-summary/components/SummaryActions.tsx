"use client"

import { Button } from "@/shared/ui/button"
import type { SummaryViewMode } from "../utils/resolve-summary-view-mode"

interface SummaryActionsProps {
  viewMode: SummaryViewMode
  onCancel: () => void
  onSave: () => void
  isSaving: boolean
  isLoading: boolean
}

export function SummaryActions({
  viewMode,
  onCancel,
  onSave,
  isSaving,
  isLoading,
}: SummaryActionsProps) {
  if (viewMode !== "entry") {
    return null
  }

  return (
    <div className="flex gap-3 pt-1">
      <Button
        variant="outline"
        className="flex-1 h-10 md:h-12 text-sm md:text-base font-semibold"
        onClick={onCancel}
        disabled={isSaving || isLoading}
      >
        ยกเลิกการผลิต
      </Button>
      <Button
        className="flex-1 h-10 md:h-12 text-sm md:text-base font-semibold hover:bg-green-600 text-white bg-green-950"
        onClick={onSave}
        disabled={isSaving || isLoading}
      >
        {isSaving ? "กำลังบันทึก..." : "บันทึกการผลิต"}
      </Button>
    </div>
  )
}
