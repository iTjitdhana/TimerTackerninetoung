import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.module";
import { isWorkPlanVisibleToViewer } from "../mappers/job.mapper";
import type { JobViewerContext } from "../auth/job-viewer";
import { withWeighingJobVisibility } from "../auth/job-viewer";

/**
 * ตรวจสิทธิ์การเข้าถึงงานราย job (กันการเปิดงานของคนอื่นผ่าน URL ตรง ๆ)
 * ผู้ที่มี jobs.read_all (supervisor/elevated) เข้าถึงได้ทุกงาน
 * คนอื่นเข้าถึงได้เฉพาะงานที่ตัวเองถูก assign ใน work_plan_operators (หรือ operators JSON เก่า)
 */
@Injectable()
export class JobAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanAccessWeighingJob(
    jobId: string,
    viewer: JobViewerContext,
  ): Promise<void> {
    return this.assertCanAccessJob(jobId, withWeighingJobVisibility(viewer));
  }

  async assertCanAccessJob(
    jobId: string,
    viewer: JobViewerContext,
  ): Promise<void> {
    if (viewer.canReadAll) {
      return;
    }

    if (!this.prisma.isConnected) {
      return;
    }

    const numericId = Number(jobId);
    if (Number.isNaN(numericId)) {
      return;
    }

    const workPlan = await this.prisma.work_plans.findUnique({
      where: { id: numericId },
      include: {
        work_plan_operators: {
          include: { users: true },
        },
      },
    });

    // ไม่พบงาน: ปล่อยให้ service ปลายทางโยน NotFound ตามเดิม (ไม่กลบเป็น 403)
    if (!workPlan) {
      return;
    }

    if (!isWorkPlanVisibleToViewer(workPlan, viewer)) {
      throw new ForbiddenException("คุณไม่ได้รับมอบหมายให้เข้าถึงงานนี้");
    }
  }
}
