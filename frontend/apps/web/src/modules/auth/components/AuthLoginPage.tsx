"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LoginPage, RegisterPage, I18nProvider } from "@jitdhana/pin-login"
import "@jitdhana/pin-login/styles.css"
import { authApi } from "@/shared/api-client/services"
import { clearAuthToken, getAuthToken, getDefaultLandingPath, setAuthSession } from "@/shared/lib/auth"
import { appPathForNavigation } from "@/shared/lib/base-path"
import { AUTH_BRANDING } from "../constants/branding"

interface AuthLoginPageProps {
  mode?: "login" | "register"
}

export function AuthLoginPage({ mode = "login" }: AuthLoginPageProps) {
  const router = useRouter()
  const [registerReady, setRegisterReady] = useState(mode !== "register")
  const [registerChecking, setRegisterChecking] = useState(mode === "register")

  useEffect(() => {
    if (mode !== "register") return

    let cancelled = false

    async function guardRegisterPage() {
      if (!getAuthToken()) {
        router.replace("/login")
        return
      }

      try {
        const session = await authApi.me()
        if (cancelled) return

        if (!session.needsRegistration) {
          router.replace(getDefaultLandingPath())
          return
        }

        setRegisterReady(true)
      } catch {
        if (!cancelled) {
          clearAuthToken()
          router.replace("/login")
        }
      } finally {
        if (!cancelled) {
          setRegisterChecking(false)
        }
      }
    }

    void guardRegisterPage()

    return () => {
      cancelled = true
    }
  }, [mode, router])

  const navigateAfterAuth = (path: string) => {
    window.location.assign(appPathForNavigation(path))
  }

  const handleLogin = async (pin: string) => {
    const result = await authApi.verifyPin(pin)
    setAuthSession(result)
    if (result.needsRegistration) {
      navigateAfterAuth("/register")
    } else {
      navigateAfterAuth(getDefaultLandingPath())
    }
    return result.user
  }

  if (mode === "register") {
    if (registerChecking || !registerReady) {
      return (
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          กำลังตรวจสอบสิทธิ์ลงทะเบียน...
        </div>
      )
    }

    return (
      <I18nProvider>
        <RegisterPage
          logoUrl={AUTH_BRANDING.logoUrl}
          logoAlt={AUTH_BRANDING.logoAlt}
          backgroundImageUrl={AUTH_BRANDING.backgroundImageUrl}
          footerText={AUTH_BRANDING.footerText}
          onRegister={async (newPin) => {
            const result = await authApi.registerPin(newPin)
            setAuthSession(result)
          }}
          onSuccess={() => router.push("/login")}
          onLoginClick={() => {
            clearAuthToken()
            router.push("/login")
          }}
        />
      </I18nProvider>
    )
  }

  return (
    <I18nProvider>
      <LoginPage
        logoUrl={AUTH_BRANDING.logoUrl}
        logoAlt={AUTH_BRANDING.logoAlt}
        backgroundImageUrl={AUTH_BRANDING.backgroundImageUrl}
        footerText={AUTH_BRANDING.footerText}
        onLogin={handleLogin}
        useDemoAuth={false}
      />
    </I18nProvider>
  )
}
