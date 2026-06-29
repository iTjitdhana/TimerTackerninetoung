import { ProductionSummaryForm } from "@/modules/production-summary"
import { AppShell } from "@/shared/layout/AppShell"

export default function ProductionSummaryPage() {
  return (
    <AppShell title="สรุปการผลิต">
      <div className="p-4 md:p-6">
        <ProductionSummaryForm />
      </div>
    </AppShell>
  )
}
