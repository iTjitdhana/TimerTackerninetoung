import { Injectable } from "@nestjs/common";
import { ProductionJobDto } from "../../shared/dto/production-job.dto";
import { WorkplanJobFilters, WorkplanProvider } from "./workplan.interface";

@Injectable()
export class MockWorkplanProvider implements WorkplanProvider {
  async getJobsForDate(
    date: Date,
    filters?: WorkplanJobFilters,
  ): Promise<ProductionJobDto[]> {
    const dateStr = date.toISOString().split("T")[0];

    const jobs: ProductionJobDto[] = [
      {
        id: "wp-1",
        workplanRef: "wp-1",
        jobCode: "SOUP-001",
        productName: "น้ำแกงส้ม",
        scheduledDate: dateStr,
        startTime: "09:00",
        endTime: "15:00",
        status: "pending",
        operators: [{ name: "ภา" }, { name: "สาม" }],
        buId: 1,
        buCode: "BNL",
        buName: "BNL",
      },
      {
        id: "wp-2",
        workplanRef: "wp-2",
        jobCode: "KIMCHI-001",
        productName: "กิมจิ",
        scheduledDate: dateStr,
        startTime: "13:15",
        endTime: "14:00",
        status: "completed",
        operators: [{ name: "ภา" }, { name: "เอ" }],
        buId: 1,
        buCode: "BNL",
        buName: "BNL",
      },
      {
        id: "wp-3",
        workplanRef: "wp-3",
        jobCode: "CHASHU-001",
        productName: "ชาชูต้มซีอิ๊ว",
        scheduledDate: dateStr,
        startTime: "08:00",
        endTime: "17:00",
        status: "in_production",
        operators: [],
        buId: 1,
        buCode: "BNL",
        buName: "BNL",
      },
    ];

    if (filters?.buId == null) {
      return jobs;
    }

    return jobs.filter((job) => job.buId === filters.buId);
  }
}
