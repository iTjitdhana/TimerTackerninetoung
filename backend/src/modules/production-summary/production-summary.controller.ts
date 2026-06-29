import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ProductionSummaryService } from "./production-summary.service";
import { CreateProductionSummaryDto } from "./dto/production-summary.dto";
import { JwtAuthGuard, type RequestWithUser } from "../../shared/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../shared/auth/permissions.guard";
import { RequirePermissions } from "../../shared/auth/require-permissions.decorator";
import { PermissionService } from "../../shared/auth/permission.service";
import { buildJobViewer } from "../../shared/auth/job-viewer";
import { JobAccessService } from "../../shared/services/job-access.service";

@Controller("production-summary")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductionSummaryController {
  constructor(
    private readonly service: ProductionSummaryService,
    private readonly permissionService: PermissionService,
    private readonly jobAccess: JobAccessService,
  ) {}

  @Post()
  @RequirePermissions("production_summary.write")
  create(@Body() dto: CreateProductionSummaryDto) {
    return this.service.create(dto);
  }

  @Get(":jobId")
  @RequirePermissions("production_summary.read")
  async getByJobId(
    @Param("jobId") jobId: string,
    @Req() request: RequestWithUser,
  ) {
    await this.jobAccess.assertCanAccessJob(
      jobId,
      buildJobViewer(request.user!),
    );
    const canViewCost = this.permissionService.hasAction(
      {
        menus: request.user!.permissions.menus as never,
        actions: request.user!.permissions.actions as never,
      },
      "production_summary.view_cost",
    );
    return this.service.getByJobId(jobId, canViewCost);
  }
}
