import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { FgMasterService } from "./fg-master.service";
import { UpdateFgMasterDto } from "./dto/fg-master.dto";
import { JwtAuthGuard } from "../../shared/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../shared/auth/permissions.guard";
import { RequirePermissions } from "../../shared/auth/require-permissions.decorator";

@Controller("fg-master")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FgMasterController {
  constructor(private readonly service: FgMasterService) {}

  @Get()
  @RequirePermissions("fg_master.read")
  list(@Query("q") q?: string, @Query("limit") limit?: string) {
    return this.service.list(q, limit ? parseInt(limit, 10) : 50);
  }

  @Get(":fgCode")
  @RequirePermissions("fg_master.read")
  getByCode(@Param("fgCode") fgCode: string) {
    return this.service.getByCode(fgCode);
  }

  @Patch(":fgCode")
  @RequirePermissions("fg_master.write")
  update(@Param("fgCode") fgCode: string, @Body() dto: UpdateFgMasterDto) {
    return this.service.update(fgCode, dto);
  }
}
