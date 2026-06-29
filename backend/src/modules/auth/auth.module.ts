import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ProfileAvatarService } from "./profile-avatar.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService, ProfileAvatarService],
  exports: [AuthService, ProfileAvatarService],
})
export class AuthModule {}
