import { Body, Controller, Delete, Get, Param, Post, Put, Query, Sse, UseGuards } from "@nestjs/common";
import { defer, from } from "rxjs";
import { switchMap } from "rxjs/operators";
import { FormulaWeighingService } from "./formula-weighing.service";
import {
  CreateWeighingRecordDto,
  UpdateFormulaWeighingJobSettingsDto,
} from "./dto/formula-weighing.dto";
import { JwtAuthGuard } from "../../shared/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../shared/auth/permissions.guard";
import { RequirePermissions } from "../../shared/auth/require-permissions.decorator";
import { CurrentUser } from "../../shared/auth/current-user.decorator";
import { buildJobViewer } from "../../shared/auth/job-viewer";
import type { AuthenticatedRequestUser } from "../../shared/auth/auth-user.types";
import { JobAccessService } from "../../shared/services/job-access.service";
import { parseOptionalBuId } from "../../shared/utils/bu-query.util";

@Controller("formula-weighing")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FormulaWeighingController {
  constructor(
    private readonly service: FormulaWeighingService,
    private readonly jobAccess: JobAccessService,
  ) {}

  @Get("jobs")
  getJobsForWeighing(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query("date") date?: string,
    @Query("bu_id") buId?: string,
  ) {
    return this.service.getJobsForWeighing(
      date,
      parseOptionalBuId(buId),
      buildJobViewer(user),
    );
  }

  @Get("settings/jobs")
  @RequirePermissions("formula_weighing.settings")
  getJobSettings() {
    return this.service.getJobSettings();
  }

  @Put("settings/jobs")
  @RequirePermissions("formula_weighing.settings")
  updateJobSettings(@Body() dto: UpdateFormulaWeighingJobSettingsDto) {
    return this.service.updateJobSettings(dto);
  }

  @Get("units")
  getPopularUnits(@Query("limit") limit?: string) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 30;
    return this.service.getPopularUnits(Number.isNaN(parsedLimit) ? 30 : parsedLimit);
  }

  @Get("materials")
  @RequirePermissions("formula_weighing.write")
  searchMaterials(@Query("search") search?: string, @Query("limit") limit?: string) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 30;
    return this.service.searchMaterials(search, Number.isNaN(parsedLimit) ? 30 : parsedLimit);
  }

  @Post()
  @RequirePermissions("formula_weighing.write")
  create(
    @Body() dto: CreateWeighingRecordDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.createRecord({ ...dto, weighedBy: user.sub });
  }

  @Delete(":jobId/ingredients/:materialCode")
  @RequirePermissions("formula_weighing.write")
  removeManualIngredient(
    @Param("jobId") jobId: string,
    @Param("materialCode") materialCode: string,
  ) {
    return this.service.removeManualIngredient(jobId, materialCode);
  }

  @Post(":jobId/verify")
  @RequirePermissions("formula_weighing.verify")
  verify(
    @Param("jobId") jobId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.verify(jobId, user.sub);
  }

  @Get(":jobId")
  async getByJobId(
    @Param("jobId") jobId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.jobAccess.assertCanAccessWeighingJob(jobId, buildJobViewer(user));
    return this.service.getByJobId(jobId);
  }

  /** Real-time stream (SSE) — push เมื่อข้อมูลเปลี่ยน ไม่ใช่ polling ฝั่ง client */
  @Sse(":jobId/stream")
  stream(
    @Param("jobId") jobId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return defer(() =>
      from(this.jobAccess.assertCanAccessWeighingJob(jobId, buildJobViewer(user))),
    ).pipe(switchMap(() => this.service.streamRecord(jobId)));
  }
}
