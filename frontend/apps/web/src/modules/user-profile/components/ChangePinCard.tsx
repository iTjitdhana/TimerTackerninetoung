"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { authApi } from "@/shared/api-client/services"
import { ApiError } from "@/shared/api-client"
import { setAuthSession } from "@/shared/lib/auth"
import { toast } from "@/shared/hooks/use-toast"

const PIN_PATTERN = /^\d{4}$/

function sanitizePin(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4)
}

export function ChangePinCard() {
  const [currentPin, setCurrentPin] = useState("")
  const [newPin, setNewPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setCurrentPin("")
    setNewPin("")
    setConfirmPin("")
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!PIN_PATTERN.test(currentPin) || !PIN_PATTERN.test(newPin)) {
      setError("PIN ต้องเป็นตัวเลข 4 หลัก")
      return
    }
    if (newPin !== confirmPin) {
      setError("PIN ใหม่และยืนยัน PIN ไม่ตรงกัน")
      return
    }
    if (newPin === currentPin) {
      setError("PIN ใหม่ต้องไม่ซ้ำกับ PIN เดิม")
      return
    }

    setIsSubmitting(true)
    try {
      const session = await authApi.changePin(currentPin, newPin)
      setAuthSession(session)
      reset()
      toast({
        title: "เปลี่ยน PIN สำเร็จ",
        description: "ครั้งต่อไปให้เข้าสู่ระบบด้วย PIN ใหม่",
      })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "เปลี่ยน PIN ไม่สำเร็จ"
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader>
        <CardTitle className="text-base">เปลี่ยน PIN</CardTitle>
        <CardDescription>
          ตั้ง PIN ใหม่ของคุณเอง (ตัวเลข 4 หลัก) หากเพิ่งถูกรีเซ็ต
          ให้กรอก PIN ชั่วคราวเป็น PIN ปัจจุบัน
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="current-pin">PIN ปัจจุบัน</Label>
            <Input
              id="current-pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={currentPin}
              onChange={(e) => setCurrentPin(sanitizePin(e.target.value))}
              placeholder="••••"
              className="max-w-[180px] tracking-[0.4em]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pin">PIN ใหม่</Label>
            <Input
              id="new-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={newPin}
              onChange={(e) => setNewPin(sanitizePin(e.target.value))}
              placeholder="••••"
              className="max-w-[180px] tracking-[0.4em]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pin">ยืนยัน PIN ใหม่</Label>
            <Input
              id="confirm-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(sanitizePin(e.target.value))}
              placeholder="••••"
              className="max-w-[180px] tracking-[0.4em]"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "กำลังบันทึก..." : "บันทึก PIN ใหม่"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
