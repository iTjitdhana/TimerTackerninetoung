"use client"

import { useRef, useState, type ChangeEvent } from "react"
import { Loader2 } from "lucide-react"
import { authApi } from "@/shared/api-client/services"
import { UserAvatar } from "@/shared/components/UserAvatar"
import type { AuthSessionData } from "@/shared/lib/permissions.constants"
import { cn } from "@/shared/lib/utils"

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_FILE_BYTES = 2 * 1024 * 1024

type ProfileAvatarProps = {
  avatarUrl?: string
  avatarVersion?: number
  disabled?: boolean
  className?: string
  onUploaded?: (data: AuthSessionData) => void
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }
      reject(new Error("อ่านไฟล์ไม่สำเร็จ"))
    }
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"))
    reader.readAsDataURL(file)
  })
}

export function ProfileAvatar({
  avatarUrl,
  avatarVersion = 0,
  disabled = false,
  className,
  onUploaded,
}: ProfileAvatarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP")
      return
    }

    if (file.size > MAX_FILE_BYTES) {
      setError("ขนาดรูปต้องไม่เกิน 2 MB")
      return
    }

    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)
    setUploading(true)
    setError(null)

    try {
      const imageData = await readFileAsDataUrl(file)
      const data = await authApi.uploadProfileAvatar(imageData, file.type)
      setPreviewUrl(null)
      onUploaded?.(data)
    } catch {
      setPreviewUrl(null)
      setError("อัปโหลดรูปไม่สำเร็จ")
    } finally {
      URL.revokeObjectURL(localPreview)
      setUploading(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={disabled || uploading}
        aria-label="เปลี่ยนรูปโปรไฟล์"
        title="แตะเพื่ออัปโหลดรูปโปรไฟล์"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative shrink-0 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="รูปโปรไฟล์"
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <UserAvatar
            avatarUrl={avatarUrl}
            avatarVersion={avatarVersion}
            name="รูปโปรไฟล์"
            className="h-12 w-12 rounded-full"
          />
        )}
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </span>
        ) : null}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={handleSelectFile}
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
