import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ProductionJobDto } from "../../shared/dto/production-job.dto";
import { WorkplanJobFilters, WorkplanProvider } from "./workplan.interface";

@Injectable()
export class HttpWorkplanProvider implements WorkplanProvider {
  constructor(private readonly config: ConfigService) {}

  async getJobsForDate(
    _date: Date,
    _filters?: WorkplanJobFilters,
  ): Promise<ProductionJobDto[]> {
    const apiUrl = this.config.get<string>("WORKPLAN_API_URL");
    if (!apiUrl) {
      throw new Error("WORKPLAN_API_URL is not configured");
    }
    // Placeholder for future Workplan API integration
    throw new Error("HttpWorkplanProvider is not implemented yet");
  }
}
