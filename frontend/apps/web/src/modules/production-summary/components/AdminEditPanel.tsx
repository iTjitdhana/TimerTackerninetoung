"use client"

import type { ReactNode } from "react"
import { Button } from "@/shared/ui/button"
import { AdminCollapsiblePanel } from "@/shared/ui/admin-collapsible-panel"

interface AdminEditPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
  isLoading: boolean
  children: ReactNode
}

export function AdminEditPanel({
  open,
  onOpenChange,
  onSave,
  onCancel,
  isSaving,
  isLoading,
  children,
}: AdminEditPanelProps) {
  return (
    <AdminCollapsiblePanel
      label="แก้ไข"
      description="แก้จำนวนผลผลิตด้านล่าง — ไม่เปลี่ยนผู้ปฏิบัติงาน"
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="space-y-3">
        {children}
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-9 text-sm font-semibold"
            onClick={onCancel}
            disabled={isSaving || isLoading}
          >
            ยกเลิกการแก้ไข
          </Button>
          <Button
            type="button"
            className="flex-1 h-9 text-sm font-semibold bg-amber-900 hover:bg-amber-950 text-white"
            onClick={onSave}
            disabled={isSaving || isLoading}
          >
            {isSaving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
          </Button>
        </div>
      </div>
    </AdminCollapsiblePanel>
  )
}
