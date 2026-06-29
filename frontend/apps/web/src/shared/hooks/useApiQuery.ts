"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface ApiQueryState<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
  /** โหลดข้อมูลใหม่ด้วยมือ (เช่น หลังบันทึก) */
  refetch: () => void
}

export interface UseApiQueryOptions {
  /** ปิดการ fetch อัตโนมัติ (เช่นยังไม่มี jobId) */
  enabled?: boolean
}

/**
 * Hook มาตรฐานสำหรับดึงข้อมูลฝั่ง client:
 * - จัดการ loading / error / data ให้อัตโนมัติ
 * - ยกเลิกผลลัพธ์ที่ค้างเมื่อ dependency เปลี่ยนหรือ component unmount (กัน race condition)
 * - มี refetch() ให้เรียกซ้ำ
 *
 * ใช้แทน pattern `useEffect + fetch + setState` ที่กระจัดกระจาย เพื่อให้ทุกหน้า
 * มีพฤติกรรม loading/error เหมือนกันทั้งระบบ
 *
 * @example
 * const { data, isLoading, error, refetch } = useApiQuery(
 *   () => jobsApi.getJobs(date, buId),
 *   [date, buId],
 * )
 */
export function useApiQuery<T>(
  queryFn: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  options: UseApiQueryOptions = {},
): ApiQueryState<T> {
  const { enabled = true } = options
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(enabled)
  const [error, setError] = useState<Error | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // เก็บ queryFn ล่าสุดไว้ใน ref เพื่อไม่ให้ effect rerun เพราะ identity ของ function เปลี่ยน
  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  const refetch = useCallback(() => {
    setReloadToken((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    queryFnRef
      .current()
      .then((result) => {
        if (cancelled) return
        setData(result)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, reloadToken])

  return { data, isLoading, error, refetch }
}
