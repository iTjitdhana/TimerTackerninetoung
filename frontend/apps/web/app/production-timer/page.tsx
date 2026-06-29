import { Suspense } from "react"
import { ProductionTimerPage } from "@/modules/production-timer"

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <main className="min-h-screen bg-transparent">
        <ProductionTimerPage />
      </main>
    </Suspense>
  )
}
