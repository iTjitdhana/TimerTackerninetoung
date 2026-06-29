"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import type { ProductionJob } from "@/modules/formula-weighing/types"
import { jobsApi } from "@/shared/api-client/services"
import { useApiQuery } from "@/shared/hooks/useApiQuery"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"

type ProductionJobSelectProps = {
  currentJobId: string
  currentProductName: string
  productionDate: string
  buId?: number
  sourceParam?: string | null
  isOtherDate?: boolean
}

const SELECT_JOB_PLACEHOLDER = "กรุณาเลือกงานที่ผลิต"

export function ProductionJobSelect({
  currentJobId,
  currentProductName,
  productionDate,
  buId,
  sourceParam,
  isOtherDate = false,
}: ProductionJobSelectProps) {
  const router = useRouter()

  const { data: jobsData } = useApiQuery(
    () => jobsApi.getJobs(productionDate, buId),
    [productionDate, buId],
  )

  const jobs = useMemo<ProductionJob[]>(() => {
    if (!jobsData) return []
    return [...jobsData].sort((a, b) => {
      const left = a.jobCode ?? a.id
      const right = b.jobCode ?? b.id
      return left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    })
  }, [jobsData])

  const handleChange = (selectedId: string) => {
    if (selectedId === currentJobId) return

    const job = jobs.find((item) => item.id === selectedId)
    if (!job) return

    const timeParams =
      job.startTime && job.endTime
        ? `&startTime=${encodeURIComponent(job.startTime)}&endTime=${encodeURIComponent(job.endTime)}`
        : ""
    const sourceQuery =
      sourceParam === "all-production" ? "&source=all-production" : ""

    router.push(
      `/production-timer?job=${encodeURIComponent(job.productName)}&jobId=${encodeURIComponent(job.id)}${timeParams}${sourceQuery}`,
    )
  }

  if (jobs.length === 0) {
    if (isOtherDate) {
      return (
        <p className="text-base font-medium text-muted-foreground truncate">
          ไม่มีงานในวันที่เลือก
        </p>
      )
    }
    return (
      <p className="text-lg font-bold text-foreground truncate">{currentProductName}</p>
    )
  }

  const isCurrentInList = jobs.some((job) => job.id === currentJobId)
  const selectedValue = !isOtherDate && isCurrentInList ? currentJobId : ""

  return (
    <Select value={selectedValue} onValueChange={handleChange}>
      <SelectTrigger className="h-auto w-full border-0 bg-transparent px-0 py-0 text-lg font-bold text-foreground shadow-none focus-visible:ring-0 data-[placeholder]:text-muted-foreground [&_svg]:size-5 [&_svg]:opacity-70">
        <SelectValue placeholder={SELECT_JOB_PLACEHOLDER} />
      </SelectTrigger>
      <SelectContent align="start" className="max-w-[min(100vw-2rem,36rem)]">
        {jobs.map((job) => (
          <SelectItem
            key={job.id}
            value={job.id}
            className="text-base font-medium py-2.5"
          >
            {job.productName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
