import { Suspense } from "react"
import { FormulaWeighingPage } from "@/modules/formula-weighing"

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <FormulaWeighingPage />
    </Suspense>
  )
}
