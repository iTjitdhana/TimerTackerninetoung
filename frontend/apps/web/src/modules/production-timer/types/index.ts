export interface ProductionStep {
  id: number
  name: string
  duration?: number
}

export interface StepRecord {
  stepName: string
  startTime: string
  endTime: string
  duration: string
  completed: boolean
}

export interface TimerStep {
  stepName: string
  startTime?: string
  endTime?: string
  duration?: string
  completed?: boolean
}

export interface JobOperatorProfile {
  name: string
  employeeId?: string
  hasAvatar?: boolean
}

export interface ProductionTimerSession {
  jobId: string
  jobCode?: string
  productName: string
  productionDate: string
  scheduledStartTime?: string
  scheduledEndTime?: string
  operators: JobOperatorProfile[]
  notes?: string
  steps: TimerStep[]
  started: boolean
  outputConfig?: import("@/modules/production-summary/services/production-summary.api").ProductOutputConfig
}

export interface TimerIngredient {
  id: string
  code: string
  name: string
  quantity: string
  baseQuantity?: string
  plannedUnit?: string
  actualWeight: string
  unit: string
  operatorWeighable?: boolean
  editableOnTimer?: boolean
  unitPrice?: number
}
