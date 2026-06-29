import {
  DashboardPage,
  PRODUCTION_ONLY_TABS,
} from "@/modules/dashboard"

export default function ProductionListPage() {
  return (
    <main className="min-h-screen bg-transparent">
      <DashboardPage
        allowedTabs={PRODUCTION_ONLY_TABS}
        defaultTab="production"
        activeMenu="production_list"
      />
    </main>
  )
}
