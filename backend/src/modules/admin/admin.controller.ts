import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { AdminService } from "./admin.service";
import { CreateUserDto, UpdateRoleMenusDto, UpdateUserDto } from "./dto/admin.dto";
import { JwtAuthGuard } from "../../shared/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../shared/auth/permissions.guard";
import { RequirePermissions } from "../../shared/auth/require-permissions.decorator";
import { CurrentUser } from "../../shared/auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../shared/auth/auth-user.types";

@Controller("admin")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get("users")
  @RequirePermissions("admin.users.read")
  listUsers() {
    return this.service.listUsers();
  }

  @Get("config")
  @RequirePermissions("admin.users.read")
  getConfig() {
    return this.service.getAuthConfig();
  }

  @Post("users")
  @RequirePermissions("admin.users.write")
  createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.createUser(dto, user.sub);
  }

  @Patch("users/:id")
  @RequirePermissions("admin.users.write")
  updateUser(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.updateUser(id, dto, user.sub);
  }

  @Post("users/:id/reset-pin")
  @RequirePermissions("admin.users.write")
  resetPin(@Param("id", ParseIntPipe) id: number) {
    return this.service.resetPin(id);
  }

  @Get("roles")
  @RequirePermissions("admin.users.read")
  listRoles() {
    return this.service.listRoles();
  }

  @Get("menus")
  @RequirePermissions("admin.users.read")
  listMenus() {
    return this.service.listMenus();
  }

  @Get("roles/:id/menus")
  @RequirePermissions("admin.users.read")
  getRoleMenus(@Param("id", ParseIntPipe) id: number) {
    return this.service.getRoleMenus(id);
  }

  @Put("roles/:id/menus")
  @RequirePermissions("admin.users.write")
  updateRoleMenus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateRoleMenusDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.updateRoleMenus(id, dto, user.sub);
  }
}
