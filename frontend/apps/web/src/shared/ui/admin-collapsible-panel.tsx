"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible"
import { cn } from "@/shared/lib/utils"

interface AdminCollapsiblePanelProps {
  /** ข้อความบนปุ่มเปิด/ปิด — ค่าเริ่มต้น "แก้ไข" */
  label?: string
  description?: string
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  children?: ReactNode
}

export function AdminCollapsiblePanel({
  label = "แก้ไข",
  description,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
  children,
}: AdminCollapsiblePanelProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const hasBody = Boolean(description || children)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-800/85 hover:text-amber-950 transition-colors">
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "w-3 h-3 shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      {hasBody ? (
        <CollapsibleContent>
          <div className="mt-2 rounded-md border border-amber-200/70 bg-amber-50/60 p-2.5 space-y-2.5">
            {description ? (
              <p className="text-[11px] leading-snug text-amber-950/75">{description}</p>
            ) : null}
            {children}
          </div>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  )
}
