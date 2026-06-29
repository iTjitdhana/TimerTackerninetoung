import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.module";
import {
  type AppRole,
  isAppRole,
  mapLegacyRoleNameToAppRole,
} from "./permissions.constants";

@Injectable()
export class TimetrackerUserRoleService {
  constructor(private readonly prisma: PrismaService) {}

  private get tableReady(): boolean {
    return (
      this.prisma.isConnected &&
      typeof (this.prisma as { timetracker_user_roles?: unknown })
        .timetracker_user_roles !== "undefined"
    );
  }

  async getAppRoleForUser(userId: number): Promise<AppRole | null> {
    if (!this.tableReady) {
      return null;
    }

    try {
      const row = await this.prisma.timetracker_user_roles.findUnique({
        where: { user_id: userId },
        select: { app_role: true },
      });

      if (!row?.app_role || !isAppRole(row.app_role)) {
        return null;
      }

      return row.app_role;
    } catch {
      return null;
    }
  }

  async setAppRoleForUser(
    userId: number,
    appRole: AppRole,
    actorUserId?: number | null,
  ): Promise<void> {
    if (!this.tableReady) {
      throw new Error("timetracker_user_roles table is not available");
    }

    try {
      await this.prisma.timetracker_user_roles.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          app_role: appRole,
          updated_by_user_id: actorUserId ?? null,
        },
        update: {
          app_role: appRole,
          updated_by_user_id: actorUserId ?? null,
          updated_at: new Date(),
        },
      });
    } catch {
      throw new Error("timetracker_user_roles table is not available");
    }
  }

  async ensureAppRoleForUser(
    userId: number,
    legacyRoleName: string,
    actorUserId?: number | null,
  ): Promise<AppRole> {
    const existing = await this.getAppRoleForUser(userId);
    if (existing) {
      return existing;
    }

    const appRole = mapLegacyRoleNameToAppRole(legacyRoleName);
    if (this.tableReady) {
      await this.setAppRoleForUser(userId, appRole, actorUserId);
    }
    return appRole;
  }
}
