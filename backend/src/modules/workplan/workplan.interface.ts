import { ProductionJobDto } from "../../shared/dto/production-job.dto";
import type { JobViewerContext } from "../../shared/auth/job-viewer";

export const WORKPLAN_PROVIDER = "WORKPLAN_PROVIDER";

export interface WorkplanJobFilters {
  buId?: number;
  viewer?: JobViewerContext;
}

export interface WorkplanProvider {
  getJobsForDate(
    date: Date,
    filters?: WorkplanJobFilters,
  ): Promise<ProductionJobDto[]>;
}
