"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Menu, Search } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet"
import { Input } from "@/shared/ui/input"
import { Switch } from "@/shared/ui/switch"
import { AppNavMenu, appNavSheetClassName, appNavSheetHeaderClassName, appNavSheetOverlayClassName, appNavSheetTitleClassName } from "@/shared/layout/AppNavMenu"
import { clearAuthToken } from "@/shared/lib/auth"
import { useMounted } from "@/shared/hooks/useMounted"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useApiQuery } from "@/shared/hooks/useApiQuery"
import { cn } from "@/shared/lib/utils"
import {
  formulaWeighingApi,
  type FormulaWeighingJobSetting,
} from "../services/formula-weighing.api"

export function FormulaWeighingSettingsPage() {
  const router = useRouter()
  const mounted = useMounted()
  const { permissions, canAction } = usePermissions()
  const canManageSettings = canAction("formula_weighing.settings")
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [settings, setSettings] = useState<FormulaWeighingJobSetting[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingJobCode, setSavingJobCode] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (permissions && !canManageSettings) {
      router.replace("/access-denied")
    }
  }, [permissions, canManageSettings, router])

  const { data: settingsData, isLoading, error } = useApiQuery(
    () => formulaWeighingApi.getJobSettings(),
    [],
    { enabled: canManageSettings },
  )

  useEffect(() => {
    if (settingsData) setSettings(settingsData)
  }, [settingsData])

  useEffect(() => {
    if (error) setLoadError("โหลดการตั้งค่าไม่สำเร็จ")
  }, [error])

  const visibleCount = useMemo(
    () => settings.filter((item) => item.requiresWeighing).length,
    [settings],
  )

  const filteredSettings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return settings

    return settings.filter(
      (item) =>
        item.jobName.toLowerCase().includes(query) ||
        item.jobCode.toLowerCase().includes(query),
    )
  }, [settings, searchQuery])

  const handleToggle = async (jobCode: string, requiresWeighing: boolean) => {
    const previous = settings
    const next = settings.map((item) =>
      item.jobCode === jobCode ? { ...item, requiresWeighing } : item,
    )
    setSettings(next)
    setSavingJobCode(jobCode)
    setLoadError(null)

    try {
      const item = next.find((entry) => entry.jobCode === jobCode)
      if (!item) return
      const saved = await formulaWeighingApi.updateJobSettings([item])
      setSettings(saved)
    } catch {
      setSettings(previous)
      setLoadError("บันทึกการตั้งค่าไม่สำเร็จ")
    } finally {
      setSavingJobCode(null)
    }
  }

  const handleLogout = () => {
    setIsMenuOpen(false)
    clearAuthToken()
    router.push("/login")
  }

  const menuButton = (
    <button type="button" aria-label="เมนู" className="p-2 rounded-xl hover:bg-muted/50 transition-colors">
      <Menu className="w-6 h-6" />
    </button>
  )

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border/40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
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
            <Link
              href="/formula-weighing-list"
              className="p-2 rounded-xl hover:bg-muted/50 transition-colors"
              aria-label="กลับ"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>

          <h1 className="text-lg font-bold">ตั้งค่าหน้าตวงสูตร</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-950">
          เปิด = แสดงในหน้ารายการตวงสูตร · ปิด = งานนี้ไม่ต้องตวงสูตร (จะไม่โผล่ในรายการ)
        </div>

        <p className="text-sm text-muted-foreground">
          แสดงในหน้าตวงสูตร {visibleCount} / {settings.length} งาน
          {searchQuery.trim() ? ` · พบ ${filteredSettings.length} รายการ` : null}
        </p>

        {!isLoading && settings.length > 0 ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="ค้นหาชื่องานหรือรหัสงาน..."
              className="pl-9 rounded-2xl bg-white"
              aria-label="ค้นหารายการงาน"
            />
          </div>
        ) : null}

        {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">กำลังโหลดการตั้งค่า...</p>
        ) : settings.length > 0 ? (
          filteredSettings.length > 0 ? (
          <div className="space-y-2">
            {filteredSettings.map((item) => (
              <div
                key={item.jobCode}
                className={cn(
                  "bg-white border rounded-2xl p-4 md:p-5 shadow-sm flex items-center gap-4",
                  item.requiresWeighing ? "border-border/40" : "border-slate-300 bg-slate-50",
                )}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base md:text-lg truncate">{item.jobName}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">รหัสงาน: {item.jobCode}</p>
                  {!item.requiresWeighing ? (
                    <p className="text-xs md:text-sm text-slate-600 mt-2">ไม่แสดงในหน้าตวงสูตร</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Switch
                    checked={item.requiresWeighing}
                    disabled={savingJobCode === item.jobCode}
                    onCheckedChange={(checked) => handleToggle(item.jobCode, checked)}
                    aria-label={`ตวงสูตร ${item.jobName}`}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {item.requiresWeighing ? "ต้องตวง" : "ไม่ต้องตวง"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              ไม่พบงานที่ตรงกับ &quot;{searchQuery.trim()}&quot;
            </p>
          )
        ) : (
          <p className="text-center text-muted-foreground py-8">ยังไม่มีรายการงานในระบบ</p>
        )}
      </main>
    </div>
  )
}
