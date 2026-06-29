"use client"

import { useEffect, useState } from "react"
import { User } from "lucide-react"
import { getAuthToken, getAuthUser, AUTH_USER_UPDATED_EVENT } from "@/shared/lib/auth"
import { cn } from "@/shared/lib/utils"

type UserAvatarProps = {
  avatarUrl?: string | null
  employeeId?: string
  hasAvatar?: boolean
  name?: string
  fallbackImage?: string
  className?: string
  imageClassName?: string
  avatarVersion?: number
  useSessionAvatar?: boolean
}

function buildAvatarPath(
  employeeId: string | undefined,
  hasAvatar: boolean | undefined,
  avatarUrl: string | null | undefined,
): string | null | undefined {
  if (avatarUrl) return avatarUrl
  if (!employeeId || hasAvatar === false) return undefined
  return `/auth/profile-avatar/${encodeURIComponent(employeeId)}`
}

export function UserAvatar({
  avatarUrl,
  employeeId,
  hasAvatar,
  name = "ผู้ใช้",
  fallbackImage,
  className,
  imageClassName,
  avatarVersion = 0,
  useSessionAvatar = false,
}: UserAvatarProps) {
  const [sessionAvatarUrl, setSessionAvatarUrl] = useState<string | undefined>(undefined)
  const [sessionVersion, setSessionVersion] = useState(0)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  useEffect(() => {
    if (!useSessionAvatar && !employeeId) return

    const syncAvatars = () => {
      if (useSessionAvatar) {
        setSessionAvatarUrl(getAuthUser()?.avatarUrl)
        setSessionVersion((version) => version + 1)
      }
      if (employeeId) {
        setRefreshVersion((version) => version + 1)
      }
    }

    syncAvatars()
    window.addEventListener(AUTH_USER_UPDATED_EVENT, syncAvatars)
    return () => window.removeEventListener(AUTH_USER_UPDATED_EVENT, syncAvatars)
  }, [useSessionAvatar, employeeId])

  const authUser = getAuthUser()
  const isOwnProfile =
    Boolean(employeeId) && authUser?.employeeId === employeeId
  const canLoadEmployeeAvatar =
    Boolean(employeeId) &&
    (hasAvatar === true || (isOwnProfile && Boolean(authUser?.avatarUrl)))

  const resolvedAvatarUrl = useSessionAvatar
    ? sessionAvatarUrl
    : buildAvatarPath(
        employeeId,
        canLoadEmployeeAvatar ? true : hasAvatar,
        isOwnProfile ? authUser?.avatarUrl : avatarUrl,
      )
  const effectiveVersion = useSessionAvatar
    ? sessionVersion + avatarVersion + refreshVersion
    : avatarVersion + refreshVersion

  useEffect(() => {
    setFallbackFailed(false)

    if (!resolvedAvatarUrl) {
      setLoadedUrl(null)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null
    const token = getAuthToken()

    fetch(`/api${resolvedAvatarUrl}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setLoadedUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setLoadedUrl(null)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [resolvedAvatarUrl, effectiveVersion])

  const showFallbackImage =
    Boolean(fallbackImage) && !loadedUrl && !fallbackFailed && !resolvedAvatarUrl

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-blue-100 text-blue-700",
        className,
      )}
    >
      {loadedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={loadedUrl}
          alt={name}
          className={cn("h-full w-full object-cover", imageClassName)}
        />
      ) : showFallbackImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fallbackImage}
          alt={name}
          className={cn("h-full w-full object-cover", imageClassName)}
          onError={() => setFallbackFailed(true)}
        />
      ) : name.trim() ? (
        <span className="text-[55%] font-bold leading-none">
          {name.trim().charAt(0)}
        </span>
      ) : (
        <User className="h-[55%] w-[55%]" />
      )}
    </div>
  )
}
