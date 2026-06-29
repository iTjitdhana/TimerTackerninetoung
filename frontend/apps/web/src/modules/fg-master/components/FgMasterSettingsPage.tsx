"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Menu,
  Package2,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet"
import { Input } from "@/shared/ui/input"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { Skeleton } from "@/shared/ui/skeleton"
import { Textarea } from "@/shared/ui/textarea"
import {
  AppNavMenu,
  appNavSheetClassName,
  appNavSheetHeaderClassName,
  appNavSheetOverlayClassName,
  appNavSheetTitleClassName,
} from "@/shared/layout/AppNavMenu"
import { clearAuthToken } from "@/shared/lib/auth"
import { useMounted } from "@/shared/hooks/useMounted"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useApiQuery } from "@/shared/hooks/useApiQuery"
import { toast } from "@/shared/hooks/use-toast"
import { cn } from "@/shared/lib/utils"
import { isKgUnit } from "@/modules/production-summary/services/production-summary.api"
import {
  fgMasterApi,
  type FgMasterDetail,
  type FgMasterListItem,
} from "../services/fg-master.api"

// ── Quick-preset sizes ──────────────────────────────────────────────────────
const SIZE_PRESETS = [
  { label: "450 ก.", size: "450 กรัม", rate: 0.45 },
  { label: "500 ก.", size: "500 กรัม", rate: 0.5 },
  { label: "1 กก.", size: "1 กก.", rate: 1 },
  { label: "1.5 กก.", size: "1.5 กก.", rate: 1.5 },
  { label: "2 กก.", size: "2 กก.", rate: 2 },
]

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 border border-green-200">
      <CheckCircle2 className="w-3 h-3" />
      ยืนยันแล้ว
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
      <AlertTriangle className="w-3 h-3" />
      ยังไม่ยืนยัน
    </span>
  )
}

// ── Skeleton cards while loading ──────────────────────────────────────────────
function SkeletonList() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3.5 flex gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export function FgMasterSettingsPage() {
  const router = useRouter()
  const mounted = useMounted()
  const { permissions, canAction } = usePermissions()
  const canRead = canAction("fg_master.read")
  const canWrite = canAction("fg_master.write")
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [detail, setDetail] = useState<FgMasterDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [form, setForm] = useState({
    fgUnit: "",
    fgSize: "",
    conversionRate: "",
    baseUnit: "",
    conversionDescription: "",
  })
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (permissions && !canRead) {
      router.replace("/access-denied")
    }
  }, [permissions, canRead, router])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const { data, isLoading, error, refetch } = useApiQuery(
    () => fgMasterApi.list(debouncedQuery || undefined, 100),
    [debouncedQuery],
    { enabled: canRead },
  )

  const items = data?.items ?? []
  const unverifiedCount = items.filter((i) => !i.conversionVerified).length

  const openDetail = useCallback(async (item: FgMasterListItem) => {
    setSelectedCode(item.fgCode)
    setIsLoadingDetail(true)
    setShowAdvanced(false)
    try {
      const loaded = await fgMasterApi.getByCode(item.fgCode)
      setDetail(loaded)
      setForm({
        fgUnit: loaded.fgUnit,
        fgSize: loaded.fgSize,
        conversionRate: String(loaded.conversionRate),
        baseUnit: loaded.baseUnit ?? "กก.",
        conversionDescription: loaded.conversionDescription ?? "",
      })
    } catch {
      toast({ variant: "destructive", title: "โหลดข้อมูล FG ไม่สำเร็จ" })
      setSelectedCode(null)
    } finally {
      setIsLoadingDetail(false)
    }
  }, [])

  const closeDetail = () => {
    setSelectedCode(null)
    setDetail(null)
  }

  // Live preview — อัปเดตทุกครั้งที่พิมพ์ ไม่ต้องรอ save
  const livePreview = useMemo(() => {
    const rate = parseFloat(form.conversionRate)
    const unit = form.fgUnit.trim() || "หน่วย"
    if (!Number.isFinite(rate) || rate <= 0) return null
    return { rate, unit, kg50: (50 * rate).toFixed(2) }
  }, [form.conversionRate, form.fgUnit])

  const applyPreset = (preset: (typeof SIZE_PRESETS)[number]) => {
    setForm((prev) => ({
      ...prev,
      fgSize: preset.size,
      conversionRate: String(preset.rate),
    }))
  }

  const handleSave = async () => {
    if (!selectedCode || !canWrite) return
    const conversionRate = parseFloat(form.conversionRate)
    if (!Number.isFinite(conversionRate) || conversionRate <= 0) {
      toast({
        variant: "destructive",
        title: "อัตราแปลงไม่ถูกต้อง",
        description: "กรุณาใส่ตัวเลขมากกว่า 0",
      })
      return
    }
    setIsSaving(true)
    try {
      const updated = await fgMasterApi.update(selectedCode, {
        fgUnit: form.fgUnit.trim(),
        fgSize: form.fgSize.trim(),
        conversionRate,
        baseUnit: form.baseUnit.trim() || "กก.",
        conversionDescription: form.conversionDescription.trim() || null,
      })
      setDetail(updated)
      toast({ title: "บันทึกข้อมูล FG แล้ว ✓" })
      void refetch()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "บันทึกไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    clearAuthToken()
    router.push("/login")
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/cost-dashboard"
            className="p-2 rounded-xl hover:bg-muted/60 transition-colors shrink-0"
            aria-label="กลับ"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          {/* hamburger (mobile) */}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="p-2 rounded-xl hover:bg-muted/60 transition-colors md:hidden"
              aria-label="เมนู"
            >
              <Menu className="w-5 h-5" />
            </button>
            <SheetContent
              side="left"
              className={appNavSheetClassName}
              overlayClassName={appNavSheetOverlayClassName}
            >
              <SheetHeader className={appNavSheetHeaderClassName}>
                <SheetTitle className={appNavSheetTitleClassName}>เมนู</SheetTitle>
              </SheetHeader>
              <AppNavMenu
                activeMenu="fg_master_settings"
                onNavigate={() => setIsMenuOpen(false)}
                onLogout={handleLogout}
              />
            </SheetContent>
          </Sheet>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight truncate">หน่วยสินค้า (FG)</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              จัดการอัตราแปลงหน่วยสำหรับคำนวณ yield และต้นทุน
            </p>
          </div>

          {unverifiedCount > 0 && (
            <Badge variant="secondary" className="shrink-0 bg-amber-100 text-amber-800 border-amber-200">
              {unverifiedCount} ยังไม่ยืนยัน
            </Badge>
          )}
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหารหัส FG หรือชื่อสินค้า..."
            className="pl-9 pr-9 bg-card rounded-xl shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchQuery("")
                searchRef.current?.focus()
              }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Error */}
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            โหลดรายการ FG ไม่สำเร็จ — กรุณาลองรีเฟรช
          </div>
        ) : null}

        {/* List */}
        {isLoading ? (
          <SkeletonList />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Package2 className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">ไม่พบข้อมูล FG</p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-xs underline underline-offset-2 hover:text-foreground transition-colors"
              >
                ล้างการค้นหา
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.fgCode}
                type="button"
                onClick={() => void openDetail(item)}
                className={cn(
                  "w-full text-left rounded-xl border bg-card px-4 py-3.5 shadow-sm",
                  "hover:bg-accent/50 hover:border-primary/30 transition-all duration-150",
                  "flex items-center gap-3 group",
                )}
              >
                {/* Left: status dot */}
                <span
                  className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0 mt-0.5",
                    item.conversionVerified ? "bg-green-500" : "bg-amber-500",
                  )}
                />

                {/* Center: info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{item.fgName}</span>
                    {!isKgUnit(item.fgUnit) && (
                      <span className="text-xs text-muted-foreground bg-muted rounded-md px-1.5 py-0.5 shrink-0">
                        {item.fgUnit}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="font-mono text-[11px] text-muted-foreground">{item.fgCode}</span>
                    {item.fgSize ? (
                      <span className="text-[11px] text-muted-foreground">{item.fgSize}</span>
                    ) : null}
                    {!isKgUnit(item.fgUnit) && (
                      <span className="text-[11px] text-muted-foreground">
                        × {item.conversionRate} = {(item.conversionRate).toFixed(3)} กก./หน่วย
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: badge + arrow */}
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge verified={item.conversionVerified} />
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                </div>
              </button>
            ))}

            <p className="text-xs text-muted-foreground text-center pt-1">
              {items.length} รายการ{debouncedQuery ? ` สำหรับ "${debouncedQuery}"` : ""}
            </p>
          </div>
        )}
      </main>

      {/* ── Edit Sheet ───────────────────────────────────────────────────────── */}
      <Sheet open={Boolean(selectedCode)} onOpenChange={(open) => !open && closeDetail()}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Package2 className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-base leading-tight">
                  {detail?.fgName ?? selectedCode ?? ""}
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{selectedCode}</p>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {isLoadingDetail ? (
              <div className="space-y-3">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>
            ) : detail ? (
              <>
                {/* ── Status card ───────────────────────────────────────────── */}
                <div
                  className={cn(
                    "rounded-xl border px-4 py-3 space-y-2",
                    detail.outputConfig.conversionVerified
                      ? "border-green-200 bg-green-50"
                      : "border-amber-200 bg-amber-50",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge verified={detail.outputConfig.conversionVerified} />
                    {livePreview && (
                      <span className="text-xs font-medium tabular-nums text-foreground">
                        50 {livePreview.unit} = {livePreview.kg50} กก.
                      </span>
                    )}
                  </div>
                  {detail.outputConfig.conversionWarnings.map((w) => (
                    <p key={w} className="text-xs text-amber-800 flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      {w}
                    </p>
                  ))}
                  {detail.outputConfig.conversionInfos.map((info) => (
                    <p key={info} className="text-xs text-green-800 flex items-start gap-1.5">
                      <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
                      {info}
                    </p>
                  ))}
                </div>

                {/* ── Main fields ───────────────────────────────────────────── */}
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    ข้อมูลหน่วยสินค้า
                  </h3>

                  {/* หน่วยขาย */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">หน่วยขาย</label>
                    <p className="text-xs text-muted-foreground">เช่น แพ็ค, ถุง, กก.</p>
                    <Input
                      value={form.fgUnit}
                      onChange={(e) => setForm((p) => ({ ...p, fgUnit: e.target.value }))}
                      placeholder="แพ็ค"
                      disabled={!canWrite || isSaving}
                    />
                  </div>

                  {/* ขนาดมาตรฐาน */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">ขนาดมาตรฐาน</label>
                    <p className="text-xs text-muted-foreground">ขนาดต่อ 1 หน่วยขาย เช่น 450 กรัม</p>
                    <Input
                      value={form.fgSize}
                      onChange={(e) => setForm((p) => ({ ...p, fgSize: e.target.value }))}
                      placeholder="450 กรัม"
                      disabled={!canWrite || isSaving}
                    />
                    {/* Quick presets */}
                    {canWrite && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {SIZE_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => applyPreset(preset)}
                            disabled={isSaving}
                            className={cn(
                              "px-2 py-1 rounded-lg text-xs border transition-colors",
                              form.fgSize === preset.size
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/60 border-border hover:bg-muted text-foreground",
                            )}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* อัตราแปลง */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      อัตราแปลงหน่วย
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        (กก. ต่อ 1 หน่วยขาย)
                      </span>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      450 กรัม/แพ็ค = 0.45 · 1 กก./แพ็ค = 1
                    </p>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      value={form.conversionRate}
                      onChange={(e) => setForm((p) => ({ ...p, conversionRate: e.target.value }))}
                      placeholder="0.45"
                      disabled={!canWrite || isSaving}
                      className="tabular-nums"
                    />
                    {/* Live preview */}
                    {livePreview && (
                      <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-foreground space-y-0.5">
                        <p className="font-medium">ตัวอย่างการแปลง</p>
                        <p className="tabular-nums text-muted-foreground">
                          1 {livePreview.unit} = {livePreview.rate} กก.
                        </p>
                        <p className="tabular-nums text-muted-foreground">
                          50 {livePreview.unit} = {livePreview.kg50} กก.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Advanced ────────────────────────────────────────────── */}
                <div className="border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 transition-transform",
                        showAdvanced && "rotate-90",
                      )}
                    />
                    ตั้งค่าขั้นสูง
                  </button>

                  {showAdvanced && (
                    <div className="mt-4 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">หน่วยฐาน (Base unit)</label>
                        <p className="text-xs text-muted-foreground">โดยปกติคือ กก.</p>
                        <Input
                          value={form.baseUnit}
                          onChange={(e) => setForm((p) => ({ ...p, baseUnit: e.target.value }))}
                          placeholder="กก."
                          disabled={!canWrite || isSaving}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">ตัวแปลงหลายขนาด (JSON)</label>
                        <p className="text-xs text-muted-foreground">
                          ถ้าสินค้าขายหลายขนาดพร้อมกัน ใส่เป็น JSON array
                        </p>
                        <Textarea
                          value={form.conversionDescription}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, conversionDescription: e.target.value }))
                          }
                          rows={5}
                          className="font-mono text-xs"
                          placeholder={`[\n  {"label":"แพ็ค 450g","unit":"แพ็ค","conversionRate":0.45},\n  {"label":"แพ็ค 1กก.","unit":"แพ็ค","conversionRate":1}\n]`}
                          disabled={!canWrite || isSaving}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>

          {/* ── Footer actions ──────────────────────────────────────────────── */}
          {detail && (
            <div className="border-t border-border px-5 py-4 shrink-0">
              {canWrite ? (
                <Button
                  onClick={() => void handleSave()}
                  disabled={isSaving || isLoadingDetail}
                  className="w-full"
                >
                  {isSaving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                </Button>
              ) : (
                <p className="text-xs text-center text-muted-foreground">
                  ต้องมีสิทธิ์ fg_master.write จึงจะแก้ไขได้
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
