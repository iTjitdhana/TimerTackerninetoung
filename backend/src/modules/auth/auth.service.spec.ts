import { describe, expect, it, vi } from "vitest";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import type { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import type { PrismaService } from "../../shared/prisma/prisma.module";
import type { PermissionService } from "../../shared/auth/permission.service";
import type { TimetrackerUserRoleService } from "../../shared/auth/timetracker-user-role.service";
import type { ProfileAvatarService } from "./profile-avatar.service";
import { mapLegacyRoleNameToAppRole } from "../../shared/auth/permissions.constants";

function createService(prismaOverrides: Record<string, unknown>) {
  const prisma = {
    isConnected: true,
    ...prismaOverrides,
  } as unknown as PrismaService;
  const jwt = {
    sign: vi.fn().mockReturnValue("token"),
  } as unknown as JwtService;
  const permissionService = {
    resolvePermissions: vi
      .fn()
      .mockResolvedValue({ menus: [], actions: [] }),
  } as unknown as PermissionService;
  const timetrackerUserRoleService = {
    ensureAppRoleForUser: vi.fn(async (_userId: number, legacyRoleName: string) =>
      mapLegacyRoleNameToAppRole(legacyRoleName),
    ),
    getAppRoleForUser: vi.fn().mockResolvedValue(null),
    setAppRoleForUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as TimetrackerUserRoleService;
  const profileAvatarService = {
    hasAvatar: vi.fn().mockReturnValue(false),
  } as unknown as ProfileAvatarService;
  return new AuthService(
    prisma,
    jwt,
    permissionService,
    timetrackerUserRoleService,
    profileAvatarService,
  );
}

describe("AuthService.changePin", () => {
  it("updates pin_display and password when the current pin is correct", async () => {
    const password = await hash("1439", 10);
    const update = vi.fn().mockResolvedValue({});
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({
        id: 13,
        id_code: "saam",
        name: "สาม",
        role_id: 5,
        password,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 13,
        id_code: "saam",
        name: "สาม",
        role_id: 5,
        department: null,
        position: null,
        email: null,
        phone: null,
      });

    const service = createService({
      users: { findFirst, update },
      role_configurations: {
        findUnique: vi.fn().mockResolvedValue({
          id: 5,
          role_name: "supervisor",
          display_name: "Supervisor",
        }),
      },
    });

    const result = await service.changePin("saam", {
      currentPin: "1439",
      newPin: "2468",
    });

    const data = update.mock.calls[0][0].data;
    expect(data.pin_display).toBe("2468");
    await expect(compare("2468", data.password)).resolves.toBe(true);
    expect(result.token).toBe("token");
  });

  it("rejects an incorrect current pin", async () => {
    const password = await hash("1439", 10);
    const service = createService({
      users: {
        findFirst: vi.fn().mockResolvedValue({
          id: 13,
          id_code: "saam",
          name: "สาม",
          role_id: 5,
          password,
        }),
      },
    });

    await expect(
      service.changePin("saam", { currentPin: "0000", newPin: "2468" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects when the new pin equals the current pin", async () => {
    const password = await hash("1439", 10);
    const service = createService({
      users: {
        findFirst: vi.fn().mockResolvedValue({
          id: 13,
          id_code: "saam",
          name: "สาม",
          role_id: 5,
          password,
        }),
      },
    });

    await expect(
      service.changePin("saam", { currentPin: "1439", newPin: "1439" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("AuthService.registerPin", () => {
  it("updates pin when the account still needs registration", async () => {
    const password = await hash("5821", 10);
    const update = vi.fn().mockResolvedValue({});
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({
        id: 21,
        id_code: "newbie",
        name: "ใหม่",
        role_id: 4,
        employee_code: "NEEDS_REGISTER",
        password,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 21,
        id_code: "newbie",
        name: "ใหม่",
        role_id: 4,
        employee_code: null,
        department: null,
        position: null,
        email: null,
        phone: null,
      });

    const service = createService({
      users: { findFirst, update },
      role_configurations: {
        findUnique: vi.fn().mockResolvedValue({
          id: 4,
          role_name: "viewer",
          display_name: "Viewer",
        }),
      },
    });

    const result = await service.registerPin("newbie", { newPin: "7391" });

    const data = update.mock.calls[0][0].data;
    expect(data.pin_display).toBe("7391");
    expect(data.employee_code).toBeNull();
    await expect(compare("7391", data.password)).resolves.toBe(true);
    expect(result.token).toBe("token");
  });

  it("rejects when the account does not need registration", async () => {
    const service = createService({
      users: {
        findFirst: vi.fn().mockResolvedValue({
          id: 21,
          id_code: "newbie",
          employee_code: null,
        }),
      },
    });

    await expect(
      service.registerPin("newbie", { newPin: "7391" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("AuthService.getSession", () => {
  it("returns needsRegistration when employee_code is NEEDS_REGISTER", async () => {
    const service = createService({
      users: {
        findFirst: vi.fn().mockResolvedValue({
          id: 21,
          id_code: "newbie",
          name: "ใหม่",
          role_id: 4,
          employee_code: "NEEDS_REGISTER",
          department: null,
          position: null,
          email: null,
          phone: null,
        }),
      },
      role_configurations: {
        findUnique: vi.fn().mockResolvedValue({
          id: 4,
          role_name: "viewer",
          display_name: "Viewer",
        }),
      },
    });

    const session = await service.getSession("newbie", "ใหม่", "viewer", 4);

    expect(session.needsRegistration).toBe(true);
  });

  it("returns needsRegistration false for registered accounts", async () => {
    const service = createService({
      users: {
        findFirst: vi.fn().mockResolvedValue({
          id: 13,
          id_code: "saam",
          name: "สาม",
          role_id: 5,
          employee_code: null,
          department: null,
          position: null,
          email: null,
          phone: null,
        }),
      },
      role_configurations: {
        findUnique: vi.fn().mockResolvedValue({
          id: 5,
          role_name: "supervisor",
          display_name: "Supervisor",
        }),
      },
    });

    const session = await service.getSession("saam", "สาม", "supervisor", 5);

    expect(session.needsRegistration).toBe(false);
  });
});
