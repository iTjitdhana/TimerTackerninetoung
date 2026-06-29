import type { JobOperatorProfile } from "./job-operator.dto";

export interface ProductionJobDto {
  id: string;
  workplanRef?: string | null;
  jobCode: string;
  productName: string;
  scheduledDate: string;
  startTime?: string | null;
  endTime?: string | null;
  status: string;
  operators: JobOperatorProfile[];
  notes?: string | null;
  buId?: number;
  buCode?: string;
  buName?: string;
  createdAt?: string;
}
