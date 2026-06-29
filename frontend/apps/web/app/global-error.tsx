"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Fatal app error:", error)
  }, [error])

  return (
    <html lang="th">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
          ระบบขัดข้อง
        </h2>
        <p style={{ color: "#64748b", maxWidth: "28rem" }}>
          เกิดข้อผิดพลาดร้ายแรง กรุณาโหลดหน้าใหม่อีกครั้ง
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid #cbd5e1",
            cursor: "pointer",
          }}
        >
          ลองใหม่
        </button>
      </body>
    </html>
  )
}
