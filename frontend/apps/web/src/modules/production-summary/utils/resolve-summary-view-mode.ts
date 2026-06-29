export type SummaryViewMode = "entry" | "saved" | "adminEditing"

export function resolveSummaryViewMode(params: {
  hasSavedSummary: boolean
  isAdminEditor: boolean
  adminEditing: boolean
}): SummaryViewMode {
  const { hasSavedSummary, isAdminEditor, adminEditing } = params
  if (!hasSavedSummary) return "entry"
  if (isAdminEditor && adminEditing) return "adminEditing"
  return "saved"
}
