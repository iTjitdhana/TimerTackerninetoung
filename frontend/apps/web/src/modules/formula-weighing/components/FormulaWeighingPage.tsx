"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"
import { AppShell } from "@/shared/layout/AppShell"
import { Button } from "@/shared/ui/button"
import { Card } from "@/shared/ui/card"
import { Input } from "@/shared/ui/input"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useMounted } from "@/shared/hooks/useMounted"
import { FORMULA_WEIGHING_LABELS as L } from "../constants/labels"
import type { FormulaWeighingLine } from "../types"
import { useFormulaWeighing } from "../hooks/useFormulaWeighing"
import { FormulaWeighingHeader } from "./FormulaWeighingHeader"
import { FormulaLinesTable } from "./FormulaLinesTable"
import { WithdrawWeightDialog } from "./WithdrawWeightDialog"
import { AddMaterialDialog } from "./AddMaterialDialog"

export function FormulaWeighingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { canAction } = usePermissions()
  const mounted = useMounted()
  const jobFromUrl = searchParams.get("job")
  const jobId = searchParams.get("jobId")

  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [selectedLine, setSelectedLine] = useState<FormulaWeighingLine | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const formula = useFormulaWeighing(jobId, jobFromUrl || "กรุณาเลือก")

  const handleOpenAddDialog = () => {
    formula.setLoadError(null)
    setIsAddDialogOpen(true)
  }

  const handleOpenWithdrawDialog = (line: FormulaWeighingLine) => {
    setSelectedLine(line)
    setIsWithdrawOpen(true)
  }

  const headerExtra = (
    <FormulaWeighingHeader
      date={date}
      onDateChange={setDate}
      productionLine={formula.productionLine}
      productCode={formula.productCode}
    />
  )

  return (
    <AppShell title={L.pageTitle} headerExtra={headerExtra}>
      <div className="p-2.5 md:p-4 lg:p-6">
        <Card className="overflow-hidden">
          <div className="p-2 md:p-3 lg:p-4 mt-0.5">
            <div className="w-full flex items-center justify-between gap-2 mb-0.5 p-2 md:p-3">
              <h4 className="text-base font-bold text-foreground md:text-xl lg:text-2xl">{L.sectionTitle}</h4>
              {canAction("formula_weighing.write") && jobId ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleOpenAddDialog}
                  className="h-9 md:h-10 bg-emerald-700 hover:bg-emerald-800 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {L.addProduct}
                </Button>
              ) : null}
            </div>
            <div className="mx-2 md:mx-3 mb-2 flex flex-wrap items-end gap-3 md:gap-4">
              <div className="flex items-center gap-3 md:gap-4">
                <label
                  htmlFor="batch-count"
                  className="text-xs md:text-sm font-medium text-muted-foreground shrink-0"
                >
                  {L.fieldBatchCount}
                </label>
                <Input
                  id="batch-count"
                  type="number"
                  min={1}
                  step={1}
                  value={formula.batchCount}
                  onChange={(e) => formula.handleBatchCountChange(e.target.value)}
                  disabled={!!formula.verifiedAt || formula.isLoading}
                  className="w-24 md:w-28 text-center font-sans"
                />
              </div>
            </div>
            {!formula.hasFormula && !formula.isLoading ? (
              <div className="mx-2 md:mx-3 mb-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950">
                {L.errors.noFormula}
              </div>
            ) : null}
            {formula.loadError ? (
              <p className="p-3 text-sm text-destructive">{formula.loadError}</p>
            ) : null}
            {formula.isLoading ? (
              <p className="p-3 text-sm text-muted-foreground">กำลังโหลดสูตร...</p>
            ) : null}
            {!formula.isLoading && formula.lines.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">{L.errors.noProducts}</p>
            ) : null}
            <FormulaLinesTable
              lines={formula.lines}
              batchCount={formula.batchCount}
              canWrite={canAction("formula_weighing.write")}
              isAdmin={canAction("formula_weighing.write")}
              onOpenWithdraw={handleOpenWithdrawDialog}
              onRemoveLine={formula.removeLine}
              onNoteChange={formula.updateLineNote}
              onInlineChange={formula.updateLineInline}
            />
            <div className="flex gap-2 md:gap-3 mt-3 md:mt-4">
              <Button
                onClick={() => router.push("/formula-weighing-list")}
                variant="outline"
                className="flex-1 h-10 md:h-11 lg:h-12 text-base md:text-lg font-semibold bg-gray-300 hover:bg-gray-400 text-black border-0"
              >
                {L.cancel}
              </Button>
              <Button
                onClick={formula.save}
                disabled={formula.isSaving || !jobId || formula.lines.length === 0}
                className="flex-1 h-10 md:h-11 lg:h-12 text-base md:text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                {formula.isSaving ? "กำลังบันทึก..." : L.save}
              </Button>
              {canAction("formula_weighing.verify") && !formula.verifiedAt ? (
                <Button
                  onClick={formula.verify}
                  disabled={formula.isVerifying || !jobId}
                  className="flex-1 h-10 md:h-11 lg:h-12 text-base md:text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {formula.isVerifying ? "กำลังยืนยัน..." : L.verifyFormula}
                </Button>
              ) : null}
            </div>
            {formula.verifiedAt ? (
              <p className="mt-2 text-sm text-emerald-700 font-medium">{L.verified}</p>
            ) : null}
          </div>
        </Card>
      </div>

      {mounted ? (
        <WithdrawWeightDialog
          open={isWithdrawOpen}
          onOpenChange={setIsWithdrawOpen}
          line={selectedLine}
          batchCount={formula.batchCount}
          isSaving={formula.isSavingWithdrawn}
          onSave={formula.saveWithdrawn}
        />
      ) : null}

      {mounted ? (
        <AddMaterialDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          isSaving={formula.isSavingLine}
          onAddMaterial={formula.addMaterial}
          onAddCustomLine={formula.addCustomLine}
        />
      ) : null}
    </AppShell>
  )
}
