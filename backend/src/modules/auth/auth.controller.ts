import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Req,
  Res,
  Param,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import {
  ChangePinDto,
  RegisterPinDto,
  UploadProfileAvatarDto,
  VerifyPinDto,
} from "./dto/auth.dto";
import { ProfileAvatarService } from "./profile-avatar.service";
import { JwtAuthGuard, type RequestWithUser } from "../../shared/auth/jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly profileAvatarService: ProfileAvatarService,
  ) {}

  @Post("verify-pin")
  verifyPin(@Body() dto: VerifyPinDto) {
    return this.authService.verifyPin(dto);
  }

  @Post("register-pin")
  @UseGuards(JwtAuthGuard)
  registerPin(@Req() request: RequestWithUser, @Body() dto: RegisterPinDto) {
    return this.authService.registerPin(request.user!.sub, dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() request: RequestWithUser) {
    const user = request.user!;
    return this.authService.getSession(
      user.sub,
      user.name,
      user.role,
      user.roleId,
      user.appRole,
    );
  }

  @Patch("change-pin")
  @UseGuards(JwtAuthGuard)
  changePin(@Req() request: RequestWithUser, @Body() dto: ChangePinDto) {
    const user = request.user!;
    return this.authService.changePin(user.sub, dto);
  }

  @Get("profile-avatar/:employeeId")
  @UseGuards(JwtAuthGuard)
  async getProfileAvatarByEmployeeId(
    @Param("employeeId") employeeId: string,
    @Res() response: Response,
  ) {
    const avatar = await this.profileAvatarService.getAvatarFile(employeeId);
    if (!avatar) {
      throw new NotFoundException();
    }

    response.setHeader("Content-Type", avatar.mimeType);
    response.setHeader("Cache-Control", "private, max-age=60");
    response.send(avatar.buffer);
  }

  @Get("profile-avatar")
  @UseGuards(JwtAuthGuard)
  async getProfileAvatar(
    @Req() request: RequestWithUser,
    @Res() response: Response,
  ) {
    const avatar = await this.profileAvatarService.getAvatarFile(
      request.user!.sub,
    );
    if (!avatar) {
      throw new NotFoundException();
    }

    response.setHeader("Content-Type", avatar.mimeType);
    response.setHeader("Cache-Control", "private, max-age=60");
    response.send(avatar.buffer);
  }

  @Post("profile-avatar")
  @UseGuards(JwtAuthGuard)
  async uploadProfileAvatar(
    @Req() request: RequestWithUser,
    @Body() dto: UploadProfileAvatarDto,
  ) {
    const user = request.user!;
    await this.profileAvatarService.saveAvatar(
      user.sub,
      dto.imageData,
      dto.contentType,
    );
    return this.authService.getSession(
      user.sub,
      user.name,
      user.role,
      user.roleId,
      user.appRole,
    );
  }
}
