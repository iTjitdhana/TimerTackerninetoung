"use client"

import { useEffect, useState } from "react"

/**
 * คืนค่าที่ debounce แล้วของ value (อัปเดตหลังหยุดเปลี่ยนค่า delayMs)
 * ใช้คู่กับ useApiQuery เพื่อทำ search ที่ไม่ยิง API ทุกตัวอักษร
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
