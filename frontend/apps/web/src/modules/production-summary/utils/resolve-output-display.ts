import type {
  OutputVariant,
  ProductOutputConfig,
  SavedOutputSnapshot,
} from "../services/production-summary.api"

export interface OutputDisplayState {
  variants: OutputVariant[]
  baseUnit: string
  conversionVerified: boolean
  conversionWarnings: string[]
  conversionInfos: string[]
  fgCode: string | null
  useSavedSnapshot: boolean
}

export function resolveOutputDisplayState(params: {
  hasSavedSummary: boolean
  isAdminEditor: boolean
  savedSnapshot: SavedOutputSnapshot | null
  liveConfig: ProductOutputConfig
}): OutputDisplayState {
  const { hasSavedSummary, isAdminEditor, savedSnapshot, liveConfig } = params
  const useSavedSnapshot =
    hasSavedSummary && !isAdminEditor && savedSnapshot != null

  if (useSavedSnapshot && savedSnapshot) {
    return {
      variants:
        savedSnapshot.outputVariants.length > 0
          ? savedSnapshot.outputVariants
          : liveConfig.outputVariants,
      baseUnit: savedSnapshot.baseUnit || liveConfig.baseUnit || "กก.",
      conversionVerified: savedSnapshot.conversionVerified,
      conversionWarnings: savedSnapshot.conversionWarnings,
      conversionInfos: savedSnapshot.conversionInfos,
      fgCode: savedSnapshot.fgCode,
      useSavedSnapshot: true,
    }
  }

  return {
    variants:
      liveConfig.outputVariants.length > 0
        ? liveConfig.outputVariants
        : [],
    baseUnit: liveConfig.baseUnit || "กก.",
    conversionVerified: liveConfig.conversionVerified,
    conversionWarnings: liveConfig.conversionWarnings,
    conversionInfos: liveConfig.conversionInfos,
    fgCode: liveConfig.fgCode,
    useSavedSnapshot: false,
  }
}
