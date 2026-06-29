"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Menu, Package, Settings } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet"
import { AppNavMenu, appNavSheetClassName, appNavSheetHeaderClassName, appNavSheetOverlayClassName, appNavSheetTitleClassName } from "@/shared/layout/AppNavMenu"
import { clearAuthToken, getAuthUserName } from "@/shared/lib/auth"
import { useMounted } from "@/shared/hooks/useMounted"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useApiQuery } from "@/shared/hooks/useApiQuery"
import { formulaWeighingApi } from "../services/formula-weighing.api"
import { cn } from "@/shared/lib/utils"
import { BuSelector, useSelectedBuFilter } from "@/shared/components/BuSelector"
import { toBuIdQueryParam } from "@/shared/lib/bu-selection"
import {
  addDays,
  buildDateRange,
  formatLocalDate,
  formatSelectedDateHeading,
  formatDateChip,
  getRelativeDateLabel,
  getTomorrow,
  startOfLocalDay,
} from "../utils/dates"

interface ProductionJob {
  id: string
  name: string
  startTime: string
  endTime: string
  status: "pending" | "in-progress" | "completed"
}

function mapApiStatus(status: string): ProductionJob["status"] {
  if (status === "in_production") return "in-progress"
  if (status === "completed") return "completed"
  return "pending"
}

function getStatusBadge(status: string) {
  switch (status) {
    case "in-progress":
      return { bg: "bg-gradient-to-r from-amber-400 to-amber-500", text: "กำลังผลิต" }
    case "completed":
      return { bg: "bg-gradient-to-r from-emerald-500 to-teal-600", text: "เสร็จสิ้น" }
    default:
      return { bg: "bg-gradient-to-r from-slate-500 to-slate-600", text: "รอผลิต" }
  }
}

function getNumberBadgeColor(status: string) {
  switch (status) {
    case "in-progress":
      return "bg-gradient-to-br from-amber-400 to-amber-500"
    case "completed":
      return "bg-gradient-to-br from-emerald-500 to-teal-600"
    default:
      return "bg-gradient-to-br from-slate-500 to-slate-600"
  }
}

const DATE_RANGE_BEFORE = 4
const DATE_RANGE_AFTER = 4
const DATE_WINDOW_SIZE = DATE_RANGE_BEFORE + DATE_RANGE_AFTER + 1

export function FormulaWeighingListPage() {
  const router = useRouter()
  const mounted = useMounted()
  const { canAction } = usePermissions()
  const canManageSettings = canAction("formula_weighing.settings")
  const canManageFgMaster = canAction("fg_master.read")
  const selectedDateChipRef = useRef<HTMLButtonElement>(null)

  const today = useMemo(() => startOfLocalDay(new Date()), [])
  const tomorrow = useMemo(() => getTomorrow(today), [today])
  const [dateWindowOffset, setDateWindowOffset] = useState(0)
  const dateRangeCenter = useMemo(
    () => addDays(tomorrow, dateWindowOffset),
    [tomorrow, dateWindowOffset],
  )
  const dateOptions = useMemo(
    () => buildDateRange(dateRangeCenter, DATE_RANGE_BEFORE, DATE_RANGE_AFTER),
    [dateRangeCenter],
  )
  const isViewingDefaultWindow = dateWindowOffset === 0

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState("พนักงาน")
  const [selectedDate, setSelectedDate] = useState(() => getTomorrow())
  const [selectedBu, setSelectedBu] = useSelectedBuFilter()

  useEffect(() => {
    setCurrentUser(getAuthUserName())
  }, [])

  useEffect(() => {
    selectedDateChipRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    })
  }, [selectedDate, dateWindowOffset])

  const shiftDateWindow = (direction: -1 | 1) => {
    const nextOffset = dateWindowOffset + direction * DATE_WINDOW_SIZE
    const nextCenter = addDays(tomorrow, nextOffset)
    const nextOptions = buildDateRange(nextCenter, DATE_RANGE_BEFORE, DATE_RANGE_AFTER)
    const selectedKey = formatLocalDate(selectedDate)
    const stillVisible = nextOptions.some(
      (date) => formatLocalDate(date) === selectedKey,
    )

    setDateWindowOffset(nextOffset)
    if (!stillVisible) {
      setSelectedDate(nextCenter)
    }
  }

  const jumpToDefaultWindow = () => {
    setDateWindowOffset(0)
    setSelectedDate(tomorrow)
  }

  const {
    data: jobsData,
    isLoading: isLoadingJobs,
    error,
  } = useApiQuery(
    () =>
      formulaWeighingApi.getJobs(
        formatLocalDate(selectedDate),
        toBuIdQueryParam(selectedBu),
      ),
    [selectedDate, selectedBu],
  )

  const weighingJobs = useMemo<ProductionJob[]>(() => {
    if (error || !jobsData) return []
    return jobsData.map((job) => ({
      id: job.id,
      name: job.productName,
      startTime: job.startTime ?? "00:00",
      endTime: job.endTime ?? "00:00",
      status: mapApiStatus(job.status),
    }))
  }, [jobsData, error])

  const loadError = error ? "โหลดรายการงานไม่สำเร็จ" : null

  const handleJobClick = (job: ProductionJob) => {
    const productionDate = formatLocalDate(selectedDate)
    router.push(
      `/formula-weighing?job=${encodeURIComponent(job.name)}&startTime=${encodeURIComponent(job.startTime)}&endTime=${encodeURIComponent(job.endTime)}&jobId=${encodeURIComponent(job.id)}&productionDate=${encodeURIComponent(productionDate)}`,
    )
  }

  const handleLogout = () => {
    setIsMenuOpen(false)
    clearAuthToken()
    router.push("/login")
  }

  const menuButton = (
    <button
      type="button"
      aria-label="เมนู"
      className="p-2 rounded-xl hover:bg-muted/50 transition-colors"
    >
      <Menu className="w-6 h-6" />
    </button>
  )

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border/40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          {mounted ? (
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>{menuButton}</SheetTrigger>
              <SheetContent side="left" className={appNavSheetClassName} overlayClassName={appNavSheetOverlayClassName}>
                <SheetHeader className={appNavSheetHeaderClassName}>
                  <SheetTitle className={appNavSheetTitleClassName}>เมนู</SheetTitle>
                </SheetHeader>
                <AppNavMenu
                  activeMenu="formula_weighing_list"
                  onNavigate={() => setIsMenuOpen(false)}
                  onLogout={handleLogout}
                />
              </SheetContent>
            </Sheet>
          ) : (
            menuButton
          )}

          <h1 className="text-lg font-bold">รายการชั่งสูตร</h1>
          <div className="flex items-center gap-1">
            {canManageFgMaster ? (
              <Link
                href="/fg-master-settings"
                className="p-2 rounded-xl hover:bg-muted/50 transition-colors"
                aria-label="จัดการหน่วยสินค้า FG"
              >
                <Package className="w-5 h-5" />
              </Link>
            ) : null}
            {canManageSettings ? (
              <Link
                href="/formula-weighing-settings"
                className="p-2 rounded-xl hover:bg-muted/50 transition-colors"
                aria-label="ตั้งค่าหน้าตวงสูตร"
              >
                <Settings className="w-5 h-5" />
              </Link>
            ) : null}
            <span className="text-sm font-medium hidden sm:inline">{currentUser}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <section>
          <p className="text-sm font-medium text-white/90 mb-3">เลือกวันที่ผลิตเพื่อตวงสูตร</p>
          <BuSelector value={selectedBu} onChange={setSelectedBu} className="mb-4" />

          <div className="flex items-center justify-between mb-2 md:hidden">
            <div>
              <p className="text-xs text-white/70">วันที่เลือก</p>
              <p className="text-sm font-semibold text-white">
                {formatSelectedDateHeading(selectedDate, today)}
              </p>
            </div>
            {(!isViewingDefaultWindow ||
              formatLocalDate(selectedDate) !== formatLocalDate(tomorrow)) && (
              <button
                type="button"
                onClick={jumpToDefaultWindow}
                className="text-xs px-3 py-1 rounded-full border border-blue-300 text-blue-100 bg-blue-500/30 hover:bg-blue-500/50 transition-colors"
              >
                พรุ่งนี้
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 md:gap-2">
            <button
              type="button"
              onClick={() => shiftDateWindow(-1)}
              aria-label="ดูวันก่อนหน้า"
              className="shrink-0 flex h-9 w-9 md:h-12 md:w-12 items-center justify-center rounded-xl md:rounded-2xl border border-border/40 bg-white text-muted-foreground shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4 md:w-6 md:h-6" />
            </button>

            <div className="flex flex-1 gap-1 md:gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide snap-x snap-mandatory md:overflow-visible md:snap-none">
              {dateOptions.map((date) => {
                const { day, month, weekday } = formatDateChip(date)
                const relativeLabel = getRelativeDateLabel(date, today)
                const isSelected = formatLocalDate(date) === formatLocalDate(selectedDate)

                return (
                  <button
                    key={formatLocalDate(date)}
                    ref={isSelected ? selectedDateChipRef : undefined}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "snap-center shrink-0 w-10 md:w-auto md:min-w-0 md:flex-1",
                      "rounded-lg md:rounded-2xl border px-1 py-1.5 md:px-2 md:py-3 transition-all shadow-sm",
                      isSelected
                        ? "border-blue-500 bg-gradient-to-b from-blue-500 to-cyan-500 text-white shadow-md scale-105 md:scale-100"
                        : "border-border/40 bg-white text-foreground hover:border-blue-300 hover:bg-blue-50/50",
                    )}
                  >
                    <span
                      className={cn(
                        "block text-[9px] md:text-xs font-medium leading-none",
                        isSelected ? "text-white/90" : "text-muted-foreground",
                      )}
                    >
                      {relativeLabel ?? weekday}
                    </span>
                    <span className="block text-sm md:text-2xl font-bold leading-tight mt-0.5 md:mt-1">
                      {day}
                    </span>
                    <span
                      className={cn(
                        "hidden md:block text-xs leading-none mt-1",
                        isSelected ? "text-white/90" : "text-muted-foreground",
                      )}
                    >
                      {month}
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => shiftDateWindow(1)}
              aria-label="ดูวันถัดไป"
              className="shrink-0 flex h-9 w-9 md:h-12 md:w-12 items-center justify-center rounded-xl md:rounded-2xl border border-border/40 bg-white text-muted-foreground shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-foreground"
            >
              <ChevronRight className="w-4 h-4 md:w-6 md:h-6" />
            </button>
          </div>

          {!isViewingDefaultWindow && (
            <div className="hidden md:flex mt-2 justify-center">
              <button
                type="button"
                onClick={jumpToDefaultWindow}
                className="text-xs md:text-sm font-medium text-blue-200 hover:text-white underline-offset-2 hover:underline"
              >
                กลับไปพรุ่งนี้
              </button>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-base md:text-lg font-bold text-white mb-3">
            งานตวงสูตร — {formatSelectedDateHeading(selectedDate, today)}
          </h2>

          {loadError ? <p className="text-sm text-red-300 mb-3">{loadError}</p> : null}
          {isLoadingJobs ? (
            <p className="text-center text-white/70 py-8">กำลังโหลดรายการงาน...</p>
          ) : weighingJobs.length > 0 ? (
            <div className="space-y-2">
              {weighingJobs.map((job, index) => {
                const statusBadge = getStatusBadge(job.status)
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => handleJobClick(job)}
                    className="w-full text-left bg-white border border-border/30 rounded-2xl p-4 md:p-5 hover:border-blue-300/60 transition-all cursor-pointer shadow-md hover:shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-2xl ${getNumberBadgeColor(job.status)} text-white flex items-center justify-center font-bold text-base md:text-lg shadow-sm`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base md:text-lg truncate">{job.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {job.startTime} - {job.endTime}
                        </p>
                      </div>
                      <span
                        className={`${statusBadge.bg} text-white text-xs md:text-sm px-3 py-1 rounded-full font-medium whitespace-nowrap`}
                      >
                        {statusBadge.text}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-white/70 py-8">
              ไม่มีงานตวงสูตรสำหรับ{formatSelectedDateHeading(selectedDate, today)}
            </p>
          )}
        </section>
      </main>
    </div>
  )
}
