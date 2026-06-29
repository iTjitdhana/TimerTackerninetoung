import { clearAuthToken } from "@/shared/lib/auth"
import { AUTH_COOKIE } from "@/shared/lib/auth-cookies"
import { withBasePath } from "@/shared/lib/base-path"

const DEFAULT_API_BASE = "http://127.0.0.1:3001/api"

function resolveApiBase(): string {
  if (typeof window !== "undefined") {
    // Proxy ผ่าน Next.js — ใช้ port 3000 อย่างเดียว (รองรับเข้าจาก IP ใน WiFi)
    return withBasePath("/api")
  }

  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE
}

function getRequestToken(): string | null {
  if (typeof window === "undefined") return null

  const fromStorage = localStorage.getItem(AUTH_COOKIE)
  if (fromStorage) return fromStorage

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getRequestToken()

  const response = await fetch(`${resolveApiBase()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    if (response.status === 401) {
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith(withBasePath("/login"))
      ) {
        // ล้างทั้ง localStorage และ cookie ให้ตรงกับที่ middleware ตรวจ (กัน redirect วน)
        clearAuthToken()
        window.location.href = `${withBasePath("/login")}?from=${encodeURIComponent(window.location.pathname)}`
      }
      throw new ApiError(message || "กรุณาเข้าสู่ระบบใหม่", response.status)
    }
    if (response.status === 403) {
      throw new ApiError(message || "คุณไม่มีสิทธิ์เข้าถึง", response.status)
    }
    throw new ApiError(message || "Request failed", response.status)
  }

  return response.json() as Promise<T>
}

export type SseEvent = { type: string; payload?: unknown }

export type SseHandlers = {
  onEvent: (event: SseEvent) => void
  onOpen?: () => void
  onError?: (error: unknown) => void
}

/**
 * เปิด Server-Sent Events ผ่าน fetch streaming เพื่อแนบ Bearer header ได้
 * (EventSource ปกติแนบ header ไม่ได้) — auto-reconnect แบบ backoff
 * คืน disconnect() สำหรับปิด connection
 */
export function openSseConnection(path: string, handlers: SseHandlers): () => void {
  const controller = new AbortController()
  let closed = false
  let retry = 0

  async function connect(): Promise<void> {
    while (!closed) {
      try {
        const token = getRequestToken()
        const response = await fetch(`${resolveApiBase()}${path}`, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: "no-store",
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          throw new ApiError(response.statusText || "Stream failed", response.status)
        }

        handlers.onOpen?.()
        retry = 0

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (!closed) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          let boundary: number
          while ((boundary = buffer.indexOf("\n\n")) !== -1) {
            const rawFrame = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)

            const dataPayload = rawFrame
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trimStart())
              .join("\n")

            if (!dataPayload) continue

            try {
              handlers.onEvent(JSON.parse(dataPayload) as SseEvent)
            } catch {
              // เฟรมที่ไม่ใช่ JSON (เช่น comment/keep-alive) — ข้าม
            }
          }
        }
      } catch (error) {
        if (closed || controller.signal.aborted) return
        handlers.onError?.(error)
      }

      if (closed) return
      retry = Math.min(retry + 1, 5)
      const delay = Math.min(1000 * 2 ** retry, 15000)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  void connect()

  return () => {
    closed = true
    controller.abort()
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}
