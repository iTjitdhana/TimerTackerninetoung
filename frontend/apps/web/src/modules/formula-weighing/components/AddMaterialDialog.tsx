"use client"

import { useEffect, useState } from "react"
import { Button } from "@/shared/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog"
import { Input } from "@/shared/ui/input"
import { NumericQuantityInput } from "@/shared/ui/numeric-quantity-input"
import { useApiQuery } from "@/shared/hooks/useApiQuery"
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue"
import { FORMULA_WEIGHING_LABELS as L } from "../constants/labels"
import { formulaWeighingApi } from "../services/formula-weighing.api"
import type { MaterialOption } from "../types"
import { WeighingUnitSelect } from "./WeighingUnitSelect"
import type { CustomLineInput } from "../hooks/useFormulaWeighing"

interface AddMaterialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSaving: boolean
  onAddMaterial: (material: MaterialOption) => Promise<boolean>
  onAddCustomLine: (input: CustomLineInput) => Promise<boolean>
}

export function AddMaterialDialog({
  open,
  onOpenChange,
  isSaving,
  onAddMaterial,
  onAddCustomLine,
}: AddMaterialDialogProps) {
  const [addMode, setAddMode] = useState<"search" | "custom">("search")
  const [materialSearch, setMaterialSearch] = useState("")
  const [customProductCode, setCustomProductCode] = useState("")
  const [customProductName, setCustomProductName] = useState("")
  const [customPlannedQuantity, setCustomPlannedQuantity] = useState("")
  const [customPlannedUnit, setCustomPlannedUnit] = useState("")

  // รีเซ็ตฟอร์มทุกครั้งที่เปิด dialog (เทียบเท่า resetAddDialog เดิม)
  useEffect(() => {
    if (!open) return
    setAddMode("search")
    setMaterialSearch("")
    setCustomProductCode("")
    setCustomProductName("")
    setCustomPlannedQuantity("")
    setCustomPlannedUnit("")
  }, [open])

  const debouncedSearch = useDebouncedValue(materialSearch, 300)
  const trimmedSearch = debouncedSearch.trim()
  const { data: searchData, isLoading: isSearchingMaterials } = useApiQuery(
    () => formulaWeighingApi.searchMaterials(trimmedSearch),
    [trimmedSearch],
    { enabled: open && addMode === "search" && trimmedSearch.length >= 1 },
  )
  const materialResults = trimmedSearch.length >= 1 ? (searchData ?? []) : []

  const handleAddMaterial = async (material: MaterialOption) => {
    const success = await onAddMaterial(material)
    if (success) onOpenChange(false)
  }

  const handleAddCustomLine = async () => {
    const success = await onAddCustomLine({
      productCode: customProductCode,
      productName: customProductName,
      plannedQuantity: customPlannedQuantity,
      plannedUnit: customPlannedUnit,
    })
    if (success) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg top-[2%] translate-y-0 max-h-[85vh] overflow-y-auto text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl md:text-2xl text-center text-foreground">
            {L.addProduct}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={addMode === "search" ? "default" : "outline"}
              onClick={() => setAddMode("search")}
              className={addMode === "search" ? "bg-emerald-700 hover:bg-emerald-800" : ""}
            >
              ค้นหาในระบบ
            </Button>
            <Button
              type="button"
              variant={addMode === "custom" ? "default" : "outline"}
              onClick={() => setAddMode("custom")}
              className={addMode === "custom" ? "bg-emerald-700 hover:bg-emerald-800" : ""}
            >
              เพิ่มใหม่
            </Button>
          </div>

          {addMode === "search" ? (
            <>
              <Input
                value={materialSearch}
                onChange={(event) => setMaterialSearch(event.target.value)}
                placeholder={L.searchPlaceholder}
                autoFocus
              />
              {isSearchingMaterials ? (
                <p className="text-sm text-muted-foreground text-center">กำลังค้นหา...</p>
              ) : materialSearch.trim() ? (
                materialResults.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {materialResults.map((material) => (
                      <button
                        key={material.code}
                        type="button"
                        onClick={() => handleAddMaterial(material)}
                        disabled={isSaving}
                        className="w-full text-left rounded-xl border border-border/40 bg-white p-3 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                      >
                        <p className="font-semibold">{material.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {material.code} · {material.unit}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center">ไม่พบสินค้า</p>
                )
              ) : (
                <p className="text-sm text-muted-foreground text-center">พิมพ์เพื่อค้นหาสินค้า</p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">{L.fieldProductCode}</label>
                <Input
                  value={customProductCode}
                  onChange={(event) => setCustomProductCode(event.target.value)}
                  placeholder="เช่น RM-001"
                  maxLength={16}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">{L.fieldProductName}</label>
                <Input
                  value={customProductName}
                  onChange={(event) => setCustomProductName(event.target.value)}
                  placeholder="เช่น น้ำตาลทราย"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">{L.fieldPlannedQuantity}</label>
                  <NumericQuantityInput
                    value={customPlannedQuantity}
                    onChange={(event) => setCustomPlannedQuantity(event.target.value)}
                    placeholder="0.000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">{L.fieldUnit}</label>
                  <WeighingUnitSelect
                    value={customPlannedUnit}
                    onChange={setCustomPlannedUnit}
                    triggerClassName="w-full"
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={handleAddCustomLine}
                disabled={isSaving}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                {isSaving ? "กำลังบันทึก..." : L.addToList}
              </Button>
              <p className="text-xs text-muted-foreground">{L.errors.addWithdrawLater}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
