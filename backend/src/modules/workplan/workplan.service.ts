import { Inject, Injectable } from "@nestjs/common";
import {
  WORKPLAN_PROVIDER,
  WorkplanJobFilters,
  WorkplanProvider,
} from "./workplan.interface";

@Injectable()
export class WorkplanService {
  constructor(
    @Inject(WORKPLAN_PROVIDER)
    private readonly provider: WorkplanProvider,
  ) {}

  getJobsForDate(date: Date, filters?: WorkplanJobFilters) {
    return this.provider.getJobsForDate(date, filters);
  }
}
