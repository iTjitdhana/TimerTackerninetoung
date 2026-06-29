"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet"
import { Menu, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getOperatorByName } from "@/shared/lib/operators-data"
import { JobOperatorChip } from "@/shared/components/JobOperatorChip"
import { jobsApi, authApi } from "@/shared/api-client/services"
import { formulaWeighingApi } from "@/modules/formula-weighing/services/formula-weighing.api"
import {
  addDays,
  buildDateRange,
  formatLocalDate,
  formatDateChip,
  getRelativeDateLabel,
  startOfLocalDay,
} from "@/modules/formula-weighing/utils/dates"
import { AppNavMenu, appNavMenuLabelClassName, appNavMenuSubLabelClassName, appNavProfileLinkClassName, appNavSheetClassName, appNavSheetHeaderClassName, appNavSheetOverlayClassName, appNavSheetTitleClassName } from "@/shared/layout/AppNavMenu"
import type { JobOperatorProfile } from "@/modules/formula-weighing/types"
import { UserAvatar } from "@/shared/components/UserAvatar"
import {
  clearAuthToken,
  getAuthUser,
  getAuthUserName,
  getDefaultDashboardTab,
  canViewDashboardTab,
  updateAuthSessionData,
  type DashboardTab,
} from "@/shared/lib/auth"
import { getProfileSubtitle } from "@/modules/user-profile/lib/role-labels"
import type { MenuKey } from "@/shared/lib/permissions.constants"
import { useMounted } from "@/shared/hooks/useMounted"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useApiQuery } from "@/shared/hooks/useApiQuery"
import { cn } from "@/shared/lib/utils"
import { DEFAULT_BU_ID, ROGANG_BU_ID } from "@/shared/lib/bu-selection"

interface ProductionJob {
  id: string
  name: string
  startTime: string
  endTime: string
  status: "pending" | "in-progress" | "completed"
  operators?: JobOperatorProfile[]
  notes?: string | null
  createdAt?: string
}

const DASHBOARD_TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "weighing", label: "งานตวงสูตร" },
  { id: "weighing-rg", label: "งานตวงสูตรโรงแกง" },
  { id: "production", label: "งานผลิต" },
  { id: "production-rg", label: "งานผลิตโรงแกง" },
  { id: "all-production", label: "งานผลิตทั้งหมด" },
]

function getTabBuId(tab: DashboardTab): number | undefined {
  switch (tab) {
    case "weighing":
    case "production":
      return DEFAULT_BU_ID
    case "weighing-rg":
    case "production-rg":
      return ROGANG_BU_ID
    case "all-production":
      return undefined
  }
}

function isWeighingTab(tab: DashboardTab): boolean {
  return tab === "weighing" || tab === "weighing-rg"
}

function mapApiStatus(status: string): ProductionJob["status"] {
  if (status === "in_production") return "in-progress"
  if (status === "completed") return "completed"
  return "pending"
}

const DATE_RANGE_BEFORE = 4
const DATE_RANGE_AFTER = 4
const DATE_WINDOW_SIZE = DATE_RANGE_BEFORE + DATE_RANGE_AFTER + 1

const PRODUCTION_ONLY_TABS: DashboardTab[] = ["production", "production-rg"]
const ALL_PRODUCTION_TABS: DashboardTab[] = ["production", "production-rg", "all-production"]

export type DashboardPageProps = {
  allowedTabs?: DashboardTab[]
  defaultTab?: DashboardTab
  activeMenu?: MenuKey
}

function resolveInitialTab(
  allowedTabs: DashboardTab[] | undefined,
  defaultTab: DashboardTab | undefined,
): DashboardTab {
  if (defaultTab && (!allowedTabs || allowedTabs.includes(defaultTab))) {
    return defaultTab
  }
  if (allowedTabs) {
    const firstAllowed = allowedTabs.find((tab) => canViewDashboardTab(tab))
    if (firstAllowed) return firstAllowed
  }
  return getDefaultDashboardTab()
}

interface ApiJobListItem {
  id: string
  productName: string
  startTime?: string | null
  endTime?: string | null
  status: string
  operators?: JobOperatorProfile[]
  notes?: string | null
  createdAt?: string
}

function mapJobsFromApi(jobs: ApiJobListItem[]): ProductionJob[] {
  return jobs.map((job) => ({
    id: job.id,
    name: job.productName,
    startTime: job.startTime ?? "00:00",
    endTime: job.endTime ?? "00:00",
    status: mapApiStatus(job.status),
    operators: job.operators,
    notes: job.notes ?? null,
    createdAt: job.createdAt,
  }))
}

export { PRODUCTION_ONLY_TABS, ALL_PRODUCTION_TABS }

export default function DashboardPage({
  allowedTabs,
  defaultTab,
  activeMenu = "dashboard",
}: DashboardPageProps = {}) {
  const mounted = useMounted()
  const { permissions } = usePermissions()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState("พนักงาน")
  const [profileSubtitle, setProfileSubtitle] = useState("พนักงานผลิต")
  const [selectedDate, setSelectedDate] = useState(() => startOfLocalDay(new Date()))
  const [dateWindowOffset, setDateWindowOffset] = useState(0)
  const [notificationCount] = useState(0)
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    () => resolveInitialTab(allowedTabs, defaultTab),
  )
  const router = useRouter()
  const tabsContainerRef = useRef<HTMLDivElement>(null)
  const selectedDateChipRef = useRef<HTMLButtonElement>(null)

  const today = useMemo(() => startOfLocalDay(new Date()), [])
  const dateRangeCenter = useMemo(
    () => addDays(today, dateWindowOffset),
    [today, dateWindowOffset],
  )
  const dateOptions = useMemo(
    () => buildDateRange(dateRangeCenter, DATE_RANGE_BEFORE, DATE_RANGE_AFTER),
    [dateRangeCenter],
  )
  const isViewingTodayWindow = dateWindowOffset === 0

  const visibleTabs = useMemo(
    () =>
      DASHBOARD_TABS.filter((tab) => {
        if (!mounted || !permissions) return false
        if (allowedTabs && !allowedTabs.includes(tab.id)) return false
        return canViewDashboardTab(tab.id)
      }),
    [mounted, permissions, allowedTabs],
  )

  useEffect(() => {
    if (!mounted) return
    const authUser = getAuthUser()
    setCurrentUser(getAuthUserName())
    if (authUser) {
      setProfileSubtitle(
        getProfileSubtitle(authUser.role, authUser.roleDisplayName, authUser.department),
      )
    }
    setActiveTab(resolveInitialTab(allowedTabs, defaultTab))

    authApi
      .me()
      .then((data) => {
        setCurrentUser(data.user.name)
        setProfileSubtitle(
          getProfileSubtitle(data.user.role, data.user.roleDisplayName, data.user.department),
        )
        updateAuthSessionData(data)
      })
      .catch(() => undefined)
  }, [mounted, allowedTabs, defaultTab])

  useEffect(() => {
    if (!mounted || !permissions) return
    const tabAllowed = !allowedTabs || allowedTabs.includes(activeTab)
    if (!canViewDashboardTab(activeTab) || !tabAllowed) {
      setActiveTab(resolveInitialTab(allowedTabs, defaultTab))
    }
  }, [activeTab, mounted, permissions, allowedTabs, defaultTab])

  useEffect(() => {
    selectedDateChipRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    })
  }, [selectedDate, dateWindowOffset])

  const shiftDateWindow = (direction: -1 | 1) => {
    const nextOffset = dateWindowOffset + direction * DATE_WINDOW_SIZE
    const nextCenter = addDays(today, nextOffset)
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

  const jumpToToday = () => {
    setDateWindowOffset(0)
    setSelectedDate(today)
  }

  const dateStr = formatLocalDate(selectedDate)
  const canQueryJobs = Boolean(mounted && permissions && canViewDashboardTab(activeTab))

  const { data: jobsData, error, isLoading } = useApiQuery<ApiJobListItem[]>(
    () => {
      const buId = getTabBuId(activeTab)
      return isWeighingTab(activeTab)
        ? formulaWeighingApi.getJobs(dateStr, buId)
        : jobsApi.getJobs(dateStr, buId)
    },
    [dateStr, activeTab, mounted, permissions],
    { enabled: canQueryJobs },
  )

  const filteredJobs = useMemo<ProductionJob[]>(
    () => (error || !jobsData ? [] : mapJobsFromApi(jobsData)),
    [jobsData, error],
  )
  const loadError = error ? "โหลดรายการงานไม่สำเร็จ" : null

  const formattedSelectedDate = (() => {
    const { day, month, weekday } = formatDateChip(selectedDate)
    return `${weekday} ${day} ${month}`
  })()

  const formattedSelectedDateFull = (() => {
    const thDays = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"]
    const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
    return `${thDays[selectedDate.getDay()]} ${selectedDate.getDate()} ${thMonths[selectedDate.getMonth()]} ${selectedDate.getFullYear() + 543}`
  })()

  const handleJobClick = (job: (typeof filteredJobs)[number]) => {
    const jobName = job.name
    const timeParams = `&startTime=${encodeURIComponent(job.startTime)}&endTime=${encodeURIComponent(job.endTime)}&jobId=${encodeURIComponent(job.id)}`

    if (isWeighingTab(activeTab)) {
      const productionDate = formatLocalDate(selectedDate)
      router.push(
        `/formula-weighing?job=${encodeURIComponent(jobName)}${timeParams}&productionDate=${encodeURIComponent(productionDate)}`,
      )
    } else if (activeTab === "production" || activeTab === "production-rg") {
      router.push(`/production-timer?job=${encodeURIComponent(jobName)}${timeParams}`)
    } else if (activeTab === "all-production") {
      router.push(`/production-timer?job=${encodeURIComponent(jobName)}&source=all-production${timeParams}`)
    }
  }

  const handleLogout = () => {
    setIsMenuOpen(false)
    clearAuthToken()
    router.push("/login")
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return {
          bg: "bg-gradient-to-r from-slate-500 to-slate-600",
          text: "รอผลิต",
        }
      case "in-progress":
        return {
          bg: "bg-gradient-to-r from-amber-400 to-amber-500",
          text: "กำลังผลิต",
        }
      case "completed":
        return {
          bg: "bg-gradient-to-r from-emerald-600 to-emerald-700",
          text: "เสร็จสิ้น",
        }
      default:
        return {
          bg: "bg-gradient-to-r from-slate-500 to-slate-600",
          text: "รอผลิต",
        }
    }
  }

  const getNumberBadgeColor = () => {
    if (isWeighingTab(activeTab)) {
      return "bg-gradient-to-br from-blue-500 to-blue-600"
    }
    if (activeTab === "production" || activeTab === "production-rg" || activeTab === "all-production") {
      return "bg-gradient-to-br from-emerald-600 to-emerald-700"
    }
    return "bg-gradient-to-br from-slate-500 to-slate-600"
  }

  const getHoverColor = () => {
    if (isWeighingTab(activeTab)) {
      return "hover:bg-blue-50/80"
    }
    if (activeTab === "production" || activeTab === "production-rg" || activeTab === "all-production") {
      return "hover:bg-emerald-50/80"
    }
    return "hover:bg-muted/50"
  }

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case "in-progress": return "border-l-amber-400"
      case "completed": return "border-l-emerald-500"
      default: return "border-l-slate-300"
    }
  }

  const getCardBgColor = () => {
    if (isWeighingTab(activeTab)) {
      return "bg-blue-50/50"
    }
    if (activeTab === "production" || activeTab === "production-rg" || activeTab === "all-production") {
      return "bg-emerald-50/50"
    }
    return "bg-white"
  }

  const getTabButtonClassName = (tab: DashboardTab) => {
    const isActive = activeTab === tab
    if (isWeighingTab(tab)) {
      return isActive
        ? "text-white bg-gradient-to-r from-blue-500 to-cyan-500 shadow-md"
        : "text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground"
    }
    return isActive
      ? "text-white bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md"
      : "text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground"
  }

  return (
    <div className="min-h-screen bg-transparent pb-20">
      <header className="bg-white border-b border-border/40 p-3 md:p-4 lg:p-5">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <button className="p-2 hover:bg-muted/50 rounded-xl transition-colors relative">
                <Menu className="w-6 h-6 md:w-7 md:h-7 text-muted-foreground" />
                {notificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 md:w-5 md:h-5 bg-red-600 text-white text-[10px] md:text-xs font-bold rounded-full">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent side="left" className={appNavSheetClassName} overlayClassName={appNavSheetOverlayClassName}>
              <SheetHeader className={appNavSheetHeaderClassName}>
                <SheetTitle className={appNavSheetTitleClassName}>เมนู</SheetTitle>
              </SheetHeader>
              <AppNavMenu
                activeMenu={activeMenu}
                onNavigate={() => setIsMenuOpen(false)}
                onLogout={handleLogout}
                showProfile
                profileSlot={
                  <Link href="/user-profile" onClick={() => setIsMenuOpen(false)}>
                    <button type="button" className={appNavProfileLinkClassName}>
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          useSessionAvatar
                          name={currentUser}
                          fallbackImage={getOperatorByName(currentUser)?.image}
                          className="h-9 w-9 rounded-full border border-blue-200/40 md:h-10 md:w-10"
                        />
                        <div className="flex flex-col items-start">
                          <span className={appNavMenuLabelClassName}>{currentUser}</span>
                          <span className={appNavMenuSubLabelClassName}>{profileSubtitle}</span>
                        </div>
                      </div>
                    </button>
                  </Link>
                }
              />
            </SheetContent>
          </Sheet>

          <Link href="/" className="absolute left-1/2 transform -translate-x-1/2">
            <h1 className="text-xl md:text-2xl font-bold text-foreground text-center hover:text-primary transition-colors cursor-pointer">
              ระบบควบคุมการผลิตสินค้าครัวกลาง
              <div className="text-xs md:text-sm font-normal text-muted-foreground mt-0.5">Production Control System</div>
            </h1>
          </Link>

          <Link href="/user-profile">
            <UserAvatar
              useSessionAvatar
              name={currentUser}
              fallbackImage={getOperatorByName(currentUser)?.image}
              className="h-9 w-9 cursor-pointer rounded-2xl border border-border/40 transition-opacity hover:opacity-90 md:h-10 md:w-10"
            />
          </Link>
        </div>
      </header>

      <div className="p-3 md:p-5 lg:p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-4 md:p-6 mb-6 md:mb-8 border border-border/40">
          <div className="mb-4">
            <h2 className="font-bold text-foreground text-base md:text-xl">
              สวัสดี, <span className="hidden md:inline">ผู้ปฏิบัติงาน </span>{currentUser}
            </h2>
            <div className="mt-4">
              {/* Header วันที่เลือก — mobile only */}
              <div className="flex items-center justify-between mb-2 md:hidden">
                <div>
                  <p className="text-xs text-muted-foreground">วันที่เลือก</p>
                  <p className="text-sm font-semibold text-foreground">{formattedSelectedDateFull}</p>
                </div>
                {(!isViewingTodayWindow || formatLocalDate(selectedDate) !== formatLocalDate(today)) && (
                  <button
                    type="button"
                    onClick={jumpToToday}
                    className="text-xs px-3 py-1 rounded-full border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    วันนี้
                  </button>
                )}
              </div>

              {/* แถว chip */}
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
                            ? "border-blue-500 bg-gradient-to-b from-blue-500 to-cyan-500 text-white shadow-md"
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
                        <span className="block text-sm md:text-2xl font-bold leading-tight mt-0.5 md:mt-1">{day}</span>
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

              {/* "กลับไปวันนี้" — desktop only */}
              {!isViewingTodayWindow && (
                <div className="hidden md:flex mt-2 justify-center">
                  <button
                    type="button"
                    onClick={jumpToToday}
                    className="text-xs md:text-sm font-medium text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline"
                  >
                    กลับไปวันนี้
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border/40 mt-4">
            <div ref={tabsContainerRef} className="overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 min-w-max py-3">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 md:px-6 py-2.5 text-sm md:text-base font-medium transition-all whitespace-nowrap rounded-2xl",
                      getTabButtonClassName(tab.id),
                    )}
                  >
                    <span>{tab.label}</span>
                    {tab.id === activeTab && !isLoading && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-white/25">
                        {filteredJobs.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="py-4">
              {/* Legend สีสถานะ */}
              <div className="flex items-center gap-4 px-1 pb-3">
                {(["รอผลิต", "กำลังผลิต", "เสร็จสิ้น"] as const).map((label, i) => {
                  const colors = ["bg-slate-300", "bg-amber-400", "bg-emerald-500"]
                  return (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${colors[i]}`} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  )
                })}
              </div>

              {loadError ? <p className="px-4 text-sm text-destructive">{loadError}</p> : null}

              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-2xl border border-border/20 p-3 md:p-5 animate-pulse">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 md:w-11 md:h-11 rounded-xl bg-muted flex-shrink-0" />
                        <div className="flex-1 space-y-2 pt-0.5">
                          <div className="h-4 bg-muted rounded w-3/5" />
                          <div className="h-3 bg-muted rounded w-2/5" />
                        </div>
                        <div className="h-5 w-16 bg-muted rounded-xl flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredJobs.length > 0 ? (
                <div className="space-y-2">
                  {filteredJobs.map((job, index) => {
                    const statusBadge = getStatusBadge(job.status)
                    const numberBadgeColor = getNumberBadgeColor()
                    const hoverColor = getHoverColor()
                    const cardBgColor = getCardBgColor()

                    const visibleOperators = (!isWeighingTab(activeTab)
                      ? job.operators?.filter((op) => op.name.trim()) ?? []
                      : [])

                    const statusBorderColor = getStatusBorderColor(job.status)
                    const isNew = job.createdAt
                      ? formatLocalDate(new Date(job.createdAt)) === formatLocalDate(today)
                      : false

                    return (
                      <div
                        key={job.id}
                        onClick={() => handleJobClick(job)}
                        className={cn(
                          cardBgColor,
                          "border border-border/20 border-l-[3px]",
                          statusBorderColor,
                          "rounded-2xl p-3 md:p-5",
                          hoverColor,
                          "transition-all cursor-pointer shadow-sm hover:shadow-md",
                        )}
                      >
                        <div className="flex items-start gap-3 md:gap-4">
                          {/* ลำดับงาน */}
                          <div
                            className={`flex-shrink-0 w-8 h-8 md:w-11 md:h-11 rounded-xl md:rounded-2xl ${numberBadgeColor} text-white flex items-center justify-center font-bold text-sm md:text-lg shadow-sm`}
                          >
                            {index + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* แถวบน: ชื่องาน + badges */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <h4 className="text-base md:text-lg font-bold text-foreground leading-snug">
                                  {job.name}
                                </h4>
                                {isNew && (
                                  <span className="inline-flex items-center bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg text-xs font-semibold">
                                    ใหม่
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {job.name === "กิมจิ" && (
                                  <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-2 py-0.5 md:px-3 md:py-1 rounded-xl text-xs font-semibold shadow-sm">
                                    พิเศษ
                                  </div>
                                )}
                                <div
                                  className={`${statusBadge.bg} text-white px-2.5 py-0.5 md:px-4 md:py-1 rounded-xl text-xs md:text-sm font-semibold shadow-sm`}
                                >
                                  {statusBadge.text}
                                </div>
                              </div>
                            </div>

                            {/* เวลา */}
                            <p className="mt-0.5 text-sm md:text-base font-semibold text-foreground/70">
                              {job.startTime} – {job.endTime}
                            </p>

                            {/* Avatar ย่อ — mobile only */}
                            {visibleOperators.length > 0 ? (
                              <div className="flex md:hidden items-center gap-1 mt-1.5">
                                {visibleOperators.slice(0, 4).map((op) => (
                                  <UserAvatar
                                    key={op.employeeId ?? op.name}
                                    name={op.name}
                                    employeeId={op.employeeId}
                                    hasAvatar={op.hasAvatar}
                                    className="w-5 h-5 rounded-full text-[9px]"
                                  />
                                ))}
                                {visibleOperators.length > 4 && (
                                  <span className="text-xs text-muted-foreground ml-0.5">
                                    +{visibleOperators.length - 4}
                                  </span>
                                )}
                              </div>
                            ) : null}

                            {/* ผู้ปฏิบัติงานเต็ม — tablet/PC */}
                            {visibleOperators.length > 0 ? (
                              <div className="hidden md:flex items-center gap-2 mt-2.5 pt-2 border-t border-border/20">
                                <span className="text-sm font-semibold text-muted-foreground">
                                  ผู้ปฏิบัติงาน:
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {visibleOperators.map((operator) => (
                                    <JobOperatorChip
                                      key={operator.employeeId ?? operator.name}
                                      name={operator.name}
                                      employeeId={operator.employeeId}
                                      hasAvatar={operator.hasAvatar}
                                    />
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {/* หมายเหตุ */}
                            {job.notes?.trim() ? (
                              <p className="mt-1.5 text-sm md:text-base font-bold text-red-600">
                                หมายเหตุ: {job.notes.trim()}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <ClipboardList className="w-10 h-10 opacity-25" />
                  <p className="font-medium text-foreground/60">ไม่มีงานในวันที่นี้</p>
                  <p className="text-sm">{formattedSelectedDate}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
