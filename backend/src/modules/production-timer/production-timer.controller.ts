import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Sse,
  UseGuards,
} from "@nestjs/common";
import { defer, from, switchMap } from "rxjs";
import { ProductionTimerService } from "./production-timer.service";
import {
  CreateProductionSessionDto,
  AdminUpdateProductionSessionDto,
  SaveOperatorWeighingDto,
  UpdateProductionSessionDto,
} from "./dto/production-timer.dto";
import { JwtAuthGuard } from "../../shared/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../shared/auth/permissions.guard";
import { RequirePermissions } from "../../shared/auth/require-permissions.decorator";
import { CurrentUser } from "../../shared/auth/current-user.decorator";
import { buildJobViewer } from "../../shared/auth/job-viewer";
import type { AuthenticatedRequestUser } from "../../shared/auth/auth-user.types";
import { JobAccessService } from "../../shared/services/job-access.service";

@Controller("production-timer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductionTimerController {
  constructor(
    private readonly service: ProductionTimerService,
    private readonly jobAccess: JobAccessService,
  ) {}

  @Post()
  @RequirePermissions("production_timer.write")
  start(
    @Body() dto: CreateProductionSessionDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.startSession({ ...dto, startedBy: user.sub });
  }

  @Patch(":jobId")
  @RequirePermissions("production_timer.write")
  update(@Param("jobId") jobId: string, @Body() dto: UpdateProductionSessionDto) {
    return this.service.updateSession(jobId, dto);
  }

  @Patch(":jobId/admin-correction")
  @RequirePermissions("production_timer.admin_edit")
  adminCorrection(
    @Param("jobId") jobId: string,
    @Body() dto: AdminUpdateProductionSessionDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.adminUpdateSession(jobId, dto, user.sub);
  }

  @Patch(":jobId/operator-weighing")
  @RequirePermissions("production_timer.write")
  saveOperatorWeighing(
    @Param("jobId") jobId: string,
    @Body() dto: SaveOperatorWeighingDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.saveOperatorWeighing(jobId, {
      ...dto,
      weighedBy: user.sub,
    });
  }

  @Get(":jobId")
  @RequirePermissions("production_timer.read")
  async getByJobId(
    @Param("jobId") jobId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.jobAccess.assertCanAccessJob(jobId, buildJobViewer(user));
    return this.service.getByJobId(jobId);
  }

  /**
   * Real-time stream (SSE) ของ session — push เมื่อมีการเปลี่ยนแปลงเท่านั้น ไม่ใช่ polling รายนาที
   * Auth ผ่าน guard เดิม (fetch-based streaming แนบ Bearer header)
   */
  @Sse(":jobId/stream")
  @RequirePermissions("production_timer.read")
  stream(
    @Param("jobId") jobId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return defer(() =>
      from(this.jobAccess.assertCanAccessJob(jobId, buildJobViewer(user))),
    ).pipe(switchMap(() => this.service.streamSession(jobId)));
  }
}
