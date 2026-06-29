"use client"

import { useEffect } from "react"
import { Button } from "@/shared/ui/button"
import { withBasePath } from "@/shared/lib/base-path"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Unhandled UI error:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          เกิดข้อผิดพลาดที่ไม่คาดคิด
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          ระบบทำงานผิดพลาดชั่วคราว กรุณาลองใหม่อีกครั้ง
          หากยังพบปัญหาให้แจ้งทีมผู้ดูแลระบบ
        </p>
        {error.digest ? (
          <p className="text-xs text-muted-foreground/70">
            รหัสอ้างอิง: {error.digest}
          </p>
        ) : null}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset}>ลองใหม่</Button>
        <Button
          variant="outline"
          onClick={() => {
            window.location.href = withBasePath("/")
          }}
        >
          กลับหน้าหลัก
        </Button>
      </div>
    </div>
  )
}
