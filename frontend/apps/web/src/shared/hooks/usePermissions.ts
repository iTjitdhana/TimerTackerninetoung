"use client"

import { useEffect, useState } from "react"
import { authApi } from "@/shared/api-client/services"
import { getAuthToken, getPermissions, updateAuthSessionData } from "@/shared/lib/auth"
import type { ActionKey, MenuKey, UserPermissions } from "@/shared/lib/permissions.constants"

export function usePermissions() {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)

  useEffect(() => {
    setPermissions(getPermissions())

    if (!getAuthToken()) return

    authApi
      .me()
      .then((data) => {
        updateAuthSessionData(data)
        setPermissions(data.permissions)
      })
      .catch(() => {
        // Keep cached permissions when refresh fails (offline / expired token).
      })
  }, [])

  return {
    permissions,
    canViewMenu: (menuKey: MenuKey) => permissions?.menus.includes(menuKey) ?? false,
    canAction: (actionKey: ActionKey) => permissions?.actions.includes(actionKey) ?? false,
  }
}
