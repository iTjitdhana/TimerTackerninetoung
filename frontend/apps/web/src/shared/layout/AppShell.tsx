"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Menu, Home } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet"
import { authApi } from "@/shared/api-client/services"
import { getOperatorByName } from "@/shared/lib/operators-data"
import { clearAuthToken, getAuthUserName, updateAuthSessionData } from "@/shared/lib/auth"
import { UserAvatar } from "@/shared/components/UserAvatar"
import { useMounted } from "@/shared/hooks/useMounted"
import { AppNavMenu, appNavSheetClassName, appNavSheetHeaderClassName, appNavSheetOverlayClassName, appNavSheetTitleClassName } from "./AppNavMenu"

interface AppShellProps {
  title: string
  currentUser?: string
  notificationCount?: number
  headerExtra?: ReactNode
  children: ReactNode
  showHomeButton?: boolean
  /** Override root wrapper background (e.g. `bg-transparent` on branded pages). */
  shellClassName?: string
}

export function AppShell({
  title,
  currentUser = "ภา",
  notificationCount = 0,
  headerExtra,
  children,
  showHomeButton = true,
  shellClassName,
}: AppShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const mounted = useMounted()
  const router = useRouter()
  const displayUser = mounted
    ? currentUser !== "ภา"
      ? currentUser
      : getAuthUserName()
    : "ภา"
  const operator = getOperatorByName(displayUser)

  useEffect(() => {
    if (!mounted) return
    authApi
      .me()
      .then((data) => updateAuthSessionData(data))
      .catch(() => undefined)
  }, [mounted])

  const handleLogout = () => {
    setIsMenuOpen(false)
    clearAuthToken()
    router.push("/login")
  }

  return (
    <div className={`min-h-screen ${shellClassName ?? "bg-transparent"}`}>
      <header className="bg-card border-b border-border px-2.5 py-1.5 md:p-4 lg:p-5 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-1.5 md:mb-3">
          {mounted ? (
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="เมนู"
                  className="p-2 hover:bg-muted/50 rounded-lg transition-colors relative"
                >
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
                  <SheetTitle className={appNavSheetTitleClassName}>
                    <span className="flex items-center gap-2.5">
                      <img src="/icon.svg" alt="" className="w-8 h-8 rounded-lg" aria-hidden="true" />
                      ระบบครัวกลาง
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <AppNavMenu onNavigate={() => setIsMenuOpen(false)} onLogout={handleLogout} />
              </SheetContent>
            </Sheet>
          ) : (
            <button
              type="button"
              aria-label="เมนู"
              className="p-2 hover:bg-muted/50 rounded-lg transition-colors relative"
            >
              <Menu className="w-6 h-6 md:w-7 md:h-7 text-muted-foreground" />
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 md:w-5 md:h-5 bg-red-600 text-white text-[10px] md:text-xs font-bold rounded-full">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </button>
          )}

          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground leading-tight whitespace-nowrap">
            {title}
          </h1>

          <Link href="/">
            <UserAvatar
              useSessionAvatar
              name={displayUser}
              fallbackImage={operator?.image ?? "/images/pha.jpg"}
              className="h-9 w-9 cursor-pointer rounded-full border border-border/40 md:h-10 md:w-10"
            />
          </Link>
        </div>
        {headerExtra}
      </header>

      {children}

      {showHomeButton && (
        <Link href="/">
          <button className="fixed bottom-6 left-4 md:left-6 hidden md:flex items-center justify-center w-10 h-10 md:w-11 md:h-11 bg-white rounded-full shadow-xl hover:shadow-2xl hover:scale-110 transition-all border border-gray-200 z-50">
            <Home className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
          </button>
        </Link>
      )}
    </div>
  )
}
