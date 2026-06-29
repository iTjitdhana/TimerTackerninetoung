import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import type { AuthenticatedRequestUser, JwtPayload } from "./auth-user.types";
import { PermissionService } from "./permission.service";
import { PrismaService } from "../prisma/prisma.module";
import { TimetrackerUserRoleService } from "./timetracker-user-role.service";
import { isTimetrackerOwnAuthEnabled } from "./timetracker-auth.config";
import {
  APP_ROLE_LABELS,
  mapLegacyRoleNameToAppRole,
  type AppRole,
} from "./permissions.constants";

export type RequestWithUser = Request & { user?: AuthenticatedRequestUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly permissionService: PermissionService,
    private readonly prisma: PrismaService,
    private readonly timetrackerUserRoleService: TimetrackerUserRoleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing authentication token");
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const dbUser = this.prisma.isConnected
      ? await this.prisma.users.findFirst({
          where: { id_code: payload.sub, is_active: true },
          select: { id: true, role_id: true },
        })
      : null;

    const legacyRoleName = payload.role ?? "operator";
    const appRole = await this.resolveAppRole(dbUser?.id, payload);

    const permissions = await this.permissionService.resolvePermissions({
      userId: dbUser?.id,
      legacyRoleId: isTimetrackerOwnAuthEnabled()
        ? undefined
        : (dbUser?.role_id ?? payload.roleId),
      legacyRoleName,
      appRole: isTimetrackerOwnAuthEnabled() ? appRole : undefined,
    });

    request.user = {
      ...payload,
      appRole,
      role: isTimetrackerOwnAuthEnabled()
        ? APP_ROLE_LABELS[appRole]
        : payload.role,
      permissions,
    };

    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return null;
    }
    return header.slice("Bearer ".length).trim() || null;
  }

  private async resolveAppRole(
    userId: number | undefined,
    payload: JwtPayload,
  ): Promise<AppRole> {
    if (isTimetrackerOwnAuthEnabled() && userId != null) {
      const dbRole = await this.timetrackerUserRoleService.getAppRoleForUser(userId);
      if (dbRole) {
        return dbRole;
      }
    }

    return (
      payload.appRole ?? mapLegacyRoleNameToAppRole(payload.role ?? "operator")
    );
  }
}
