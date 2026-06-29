import { Injectable, NotFoundException } from "@nestjs/common";
import { DbWorkplanProvider } from "../workplan/db-workplan.provider";
import { WorkplanService } from "../workplan/workplan.service";
import { WorkplanJobFilters } from "../workplan/workplan.interface";
import { ProductionJobDto } from "../../shared/dto/production-job.dto";

@Injectable()
export class JobsService {
  constructor(
    private readonly workplan: WorkplanService,
    private readonly dbWorkplan: DbWorkplanProvider,
  ) {}

  async getJobsForDate(
    date: Date,
    filters?: WorkplanJobFilters,
  ): Promise<ProductionJobDto[]> {
    return this.workplan.getJobsForDate(date, filters);
  }

  async getJobById(id: string): Promise<ProductionJobDto> {
    const job = await this.dbWorkplan.getJobById(id);
    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return job;
  }
}
