import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { JobsService } from "./jobs.service";
import { JwtAuthGuard } from "../../shared/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../shared/auth/permissions.guard";
import { RequirePermissions } from "../../shared/auth/require-permissions.decorator";
import { CurrentUser } from "../../shared/auth/current-user.decorator";
import { buildJobViewer } from "../../shared/auth/job-viewer";
import type { AuthenticatedRequestUser } from "../../shared/auth/auth-user.types";
import { parseOptionalBuId } from "../../shared/utils/bu-query.util";

@Controller("jobs")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @RequirePermissions("jobs.read")
  getJobs(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query("date") date?: string,
    @Query("bu_id") buId?: string,
  ) {
    const targetDate = date
      ? new Date(`${date}T00:00:00.000Z`)
      : (() => {
          const now = new Date();
          return new Date(
            Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
          );
        })();
    return this.jobsService.getJobsForDate(targetDate, {
      buId: parseOptionalBuId(buId),
      viewer: buildJobViewer(user),
    });
  }

  @Get(":id")
  @RequirePermissions("jobs.read")
  getJob(@Param("id") id: string) {
    return this.jobsService.getJobById(id);
  }
}
