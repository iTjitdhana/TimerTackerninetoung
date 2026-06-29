import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { WorkplanService } from "./workplan.service";
import { parseOptionalBuId } from "../../shared/utils/bu-query.util";
import { JwtAuthGuard } from "../../shared/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../shared/auth/permissions.guard";
import { RequirePermissions } from "../../shared/auth/require-permissions.decorator";
import { CurrentUser } from "../../shared/auth/current-user.decorator";
import { buildJobViewer } from "../../shared/auth/job-viewer";
import type { AuthenticatedRequestUser } from "../../shared/auth/auth-user.types";

@Controller("workplan")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkplanController {
  constructor(private readonly workplanService: WorkplanService) {}

  @Get("jobs")
  @RequirePermissions("jobs.read")
  getJobs(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query("date") date?: string,
    @Query("bu_id") buId?: string,
  ) {
    const targetDate = date ? new Date(date) : new Date();
    return this.workplanService.getJobsForDate(targetDate, {
      buId: parseOptionalBuId(buId),
      viewer: buildJobViewer(user),
    });
  }
}
