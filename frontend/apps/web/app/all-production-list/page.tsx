import {
  DashboardPage,
  ALL_PRODUCTION_TABS,
} from "@/modules/dashboard"

export default function AllProductionListPage() {
  return (
    <main className="min-h-screen bg-transparent">
      <DashboardPage
        allowedTabs={ALL_PRODUCTION_TABS}
        defaultTab="all-production"
        activeMenu="all_production_list"
      />
    </main>
  )
}
