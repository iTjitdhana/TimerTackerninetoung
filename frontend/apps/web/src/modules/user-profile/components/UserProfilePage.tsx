"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Menu } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import {
  AppNavMenu,
  appNavSheetClassName,
  appNavSheetHeaderClassName,
  appNavSheetOverlayClassName,
  appNavSheetTitleClassName,
} from "@/shared/layout/AppNavMenu"
import {
  clearAuthToken,
  getAuthUser,
  getPermissions,
  updateAuthSessionData,
} from "@/shared/lib/auth"
import type { AuthUser, UserPermissions } from "@/shared/lib/permissions.constants"
import { authApi } from "@/shared/api-client/services"
import { useMounted } from "@/shared/hooks/useMounted"
import { getMenuLabels } from "../lib/menu-labels"
import { getProfileSubtitle, getRoleLabel } from "../lib/role-labels"
import { ChangePinCard } from "./ChangePinCard"
import { ProfileAvatar } from "./ProfileAvatar"

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value?.trim() || "—"}</p>
    </div>
  )
}

export function UserProfilePage() {
  const router = useRouter()
  const mounted = useMounted()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [canChangePin, setCanChangePin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [avatarVersion, setAvatarVersion] = useState(0)

  useEffect(() => {
    if (!mounted) return

    const cachedUser = getAuthUser()
    const cachedPermissions = getPermissions()
    if (cachedUser) setUser(cachedUser)
    if (cachedPermissions) setPermissions(cachedPermissions)

    setIsLoading(true)
    setLoadError(null)

    authApi
      .me()
      .then((data) => {
        setUser(data.user)
        setPermissions(data.permissions)
        setCanChangePin(Boolean(data.canChangePin))
        updateAuthSessionData(data)
      })
      .catch(() => {
        setLoadError("โหลดข้อมูลโปรไฟล์ไม่สำเร็จ")
        if (!cachedUser) {
          setUser(null)
        }
      })
      .finally(() => setIsLoading(false))
  }, [mounted])

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

  const roleLabel = user ? getRoleLabel(user.role, user.roleDisplayName) : "—"
  const menuLabels = permissions ? getMenuLabels(permissions.menus) : []

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
                    activeMenu="dashboard"
                    onNavigate={() => setIsMenuOpen(false)}
                    onLogout={handleLogout}
                  />
                </SheetContent>
              </Sheet>
            ) : (
              menuButton
            )}
            <Link
              href="/"
              className="p-2 rounded-xl hover:bg-muted/50 transition-colors"
              aria-label="กลับ"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>

          <h1 className="text-lg font-bold">โปรไฟล์</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}

        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ProfileAvatar
                avatarUrl={user?.avatarUrl}
                avatarVersion={avatarVersion}
                disabled={isLoading}
                onUploaded={(data) => {
                  setUser(data.user)
                  setPermissions(data.permissions)
                  setCanChangePin(Boolean(data.canChangePin))
                  updateAuthSessionData(data)
                  setAvatarVersion((version) => version + 1)
                }}
              />
              <div>
                <CardTitle>{user?.name ?? "—"}</CardTitle>
                <CardDescription>
                  {user
                    ? getProfileSubtitle(user.role, user.roleDisplayName, user.department)
                    : "กำลังโหลด..."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {isLoading && !user ? (
              <p className="text-sm text-muted-foreground sm:col-span-2">กำลังโหลดข้อมูล...</p>
            ) : (
              <>
                <ProfileField label="รหัสพนักงาน" value={user?.employeeId} />
                <ProfileField label="บทบาท" value={roleLabel} />
                <ProfileField label="ตำแหน่ง" value={user?.position} />
                <ProfileField label="แผนก" value={user?.department} />
                <ProfileField label="อีเมล" value={user?.email} />
                <ProfileField label="เบอร์โทร" value={user?.phone} />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <CardTitle className="text-base">สิทธิ์การเข้าถึง</CardTitle>
            <CardDescription>แสดงเมนูที่บัญชีนี้สามารถใช้งานได้ (ไม่สามารถแก้ไขเอง)</CardDescription>
          </CardHeader>
          <CardContent>
            {menuLabels.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {menuLabels.map((label) => (
                  <li
                    key={label}
                    className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>

        {canChangePin ? (
          <ChangePinCard />
        ) : (
          <Card className="rounded-2xl border-border/40">
            <CardHeader>
              <CardTitle className="text-base">เปลี่ยน PIN</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                บัญชีนี้ไม่สามารถเปลี่ยน PIN เองได้ กรุณาติดต่อผู้ดูแลระบบ
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
