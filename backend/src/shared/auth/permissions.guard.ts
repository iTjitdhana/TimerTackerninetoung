import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ActionKey, ResolvedPermissions } from "./permissions.constants";
import type { RequestWithUser } from "./jwt-auth.guard";
import { PERMISSIONS_KEY } from "./require-permissions.decorator";
import { PermissionService } from "./permission.service";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<ActionKey[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Authentication required");
    }

    const permissions: ResolvedPermissions = {
      menus: user.permissions.menus as ResolvedPermissions["menus"],
      actions: user.permissions.actions as ResolvedPermissions["actions"],
    };

    const allowed = this.permissionService.hasAnyAction(permissions, required);

    if (!allowed) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
