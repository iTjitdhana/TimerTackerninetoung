"use client"

import { UserAvatar } from "@/shared/components/UserAvatar"

type JobOperatorChipProps = {
  name: string
  employeeId?: string
  hasAvatar?: boolean
}

export function JobOperatorChip({
  name,
  employeeId,
  hasAvatar,
}: JobOperatorChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border/20 bg-white/50 px-3 py-1.5 transition-colors hover:bg-white/80">
      <UserAvatar
        employeeId={employeeId}
        hasAvatar={hasAvatar}
        name={name}
        className="h-7 w-7 shrink-0 rounded-full border border-border/40 md:h-8 md:w-8"
      />
      <span className="whitespace-nowrap text-sm font-semibold text-foreground md:text-base">
        {name}
      </span>
    </div>
  )
}
