"use client"

import Link from "next/link"
import { getDefaultLandingPath } from "@/shared/lib/auth"

export default function AccessDeniedPage() {
  const landingPath = getDefaultLandingPath()
  const homeHref = landingPath === "/access-denied" ? "/login" : landingPath

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-border/40 shadow-md p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">ไม่มีสิทธิ์เข้าถึง</h1>
        <p className="text-muted-foreground">
          บัญชีของคุณไม่มีสิทธิ์เปิดหน้านี้ หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อหัวหน้างาน
        </p>
        <Link
          href={homeHref}
          className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-primary-foreground font-medium"
        >
          {landingPath === "/access-denied" ? "กลับไปหน้าเข้าสู่ระบบ" : "ไปหน้าแรกที่เข้าได้"}
        </Link>
      </div>
    </div>
  )
}
