import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermissionService } from "./permission.service";
import { TimetrackerUserRoleService } from "./timetracker-user-role.service";
import { PermissionsGuard } from "./permissions.guard";

const INSECURE_JWT_SECRETS = new Set([
  "dev-secret",
  "dev-secret-change-in-production",
  "change-me",
  "",
]);

function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>("JWT_SECRET")?.trim() ?? "";
  const isProduction = config.get<string>("NODE_ENV") === "production";

  if (isProduction && (secret.length < 16 || INSECURE_JWT_SECRETS.has(secret))) {
    throw new Error(
      "JWT_SECRET must be set to a strong value (>= 16 chars) in production. " +
        "Refusing to start with a default/insecure secret.",
    );
  }

  return secret.length > 0 ? secret : "dev-secret";
}

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: resolveJwtSecret(config),
        signOptions: { expiresIn: "8h" },
      }),
    }),
  ],
  providers: [PermissionService, TimetrackerUserRoleService, JwtAuthGuard, PermissionsGuard],
  exports: [
    PermissionService,
    TimetrackerUserRoleService,
    JwtAuthGuard,
    PermissionsGuard,
    JwtModule,
  ],
})
export class AuthSharedModule {}
