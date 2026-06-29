import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../shared/auth/jwt-auth.guard";
import { BusinessUnitsService } from "./business-units.service";

@Controller("business-units")
@UseGuards(JwtAuthGuard)
export class BusinessUnitsController {
  constructor(private readonly service: BusinessUnitsService) {}

  @Get()
  list() {
    return this.service.listActive();
  }
}
