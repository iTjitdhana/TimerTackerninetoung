import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CostDashboardService } from "./cost-dashboard.service";
import { JwtAuthGuard } from "../../shared/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../shared/auth/permissions.guard";
import { RequirePermissions } from "../../shared/auth/require-permissions.decorator";
import { todayDateOnlyBangkok } from "../../shared/utils/datetime.util";

@Controller("cost-dashboard")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("admin.cost_dashboard.view")
export class CostDashboardController {
  constructor(private readonly service: CostDashboardService) {}

  @Get("daily")
  getDaily(@Query("date") date?: string) {
    const target = date ?? todayDateOnlyBangkok();
    return this.service.getDailyOverview(target);
  }

  @Get("search")
  search(@Query("q") q?: string, @Query("limit") limit?: string) {
    return this.service.searchHistory(q ?? "", limit ? parseInt(limit) : 50);
  }

  @Get("completeness-summary")
  getCompletenessSummary(
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const today = todayDateOnlyBangkok();
    return this.service.getCompletenessSummary(from ?? today, to ?? today);
  }

  @Get("non-production-preview")
  getNonProductionPreview(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ) {
    const today = todayDateOnlyBangkok();
    return this.service.getNonProductionPreview(
      from ?? today,
      to ?? today,
      limit ? parseInt(limit) : 100,
    );
  }

  @Get("completeness-pattern-preview")
  getProductionPatternPreview(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("pattern") pattern?: string,
    @Query("limit") limit?: string,
  ) {
    const today = todayDateOnlyBangkok();
    if (!pattern) return [];
    return this.service.getProductionPatternPreview(
      from ?? today,
      to ?? today,
      pattern,
      limit ? parseInt(limit) : 200,
    );
  }

  @Get("unverified-conversion")
  getUnverifiedConversionPreview(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ) {
    const today = todayDateOnlyBangkok();
    return this.service.getUnverifiedConversionPreview(
      from ?? today,
      to ?? today,
      limit ? parseInt(limit, 10) : 200,
    );
  }
}
