import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../shared/prisma/prisma.module";
import { PermissionService } from "../../shared/auth/permission.service";
import { TimetrackerUserRoleService } from "../../shared/auth/timetracker-user-role.service";
import { hashPin, verifyPinAgainstPassword } from "../../shared/auth/pin-verifier";
import { assertPinPolicy } from "../../shared/auth/pin-policy";
import {
  APP_ROLE_LABELS,
  mapLegacyRoleNameToAppRole,
  type AppRole,
  type ResolvedPermissions,
} from "../../shared/auth/permissions.constants";
import { isTimetrackerOwnAuthEnabled } from "../../shared/auth/timetracker-auth.config";
import { ChangePinDto, RegisterPinDto, VerifyPinDto } from "./dto/auth.dto";
import { ProfileAvatarService } from "./profile-avatar.service";

const DEMO_PINS: Record<
  string,
  { employeeId: string; name: string; role: string; roleId?: number; pin: string }
> = {
  "1234": { employeeId: "EMP001", name: "ภา", role: "operator", pin: "1234" },
  "5678": {
    employeeId: "EMP002",
    name: "สาม",
    role: "weighing_staff",
    pin: "5678",
  },
  "9999": { employeeId: "EMP003", name: "เอ", role: "manager", pin: "9999" },
};

export interface AuthUserProfile {
  employeeId: string;
  name: string;
  role: string;
  appRole?: AppRole;
  roleId?: number;
  roleDisplayName?: string;
  department?: string;
  position?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface AuthSessionData {
  user: AuthUserProfile;
  permissions: ResolvedPermissions;
  canChangePin: boolean;
  needsRegistration?: boolean;
}

export interface AuthSessionResponse extends AuthSessionData {
  token: string;
  needsRegistration?: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly permissionService: PermissionService,
    private readonly timetrackerUserRoleService: TimetrackerUserRoleService,
    private readonly profileAvatarService: ProfileAvatarService,
  ) {}

  private get demoPinsEnabled(): boolean {
    return (
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_DEMO_PINS === "true"
    );
  }

  async verifyPin(dto: VerifyPinDto): Promise<AuthSessionResponse> {
    if (this.prisma.isConnected) {
      const user = await this.prisma.users.findFirst({
        where: {
          pin_display: dto.pin,
          is_active: true,
        },
      });

      if (user) {
        const valid = await verifyPinAgainstPassword(dto.pin, user.password);
        if (!valid) {
          throw new UnauthorizedException("Invalid PIN");
        }

        const role = user.role_id
          ? await this.prisma.role_configurations.findUnique({
              where: { id: user.role_id },
            })
          : null;

        const needsRegistration = user.employee_code === "NEEDS_REGISTER";
        const session = await this.issueTokenForDbUser(
          user,
          role?.role_name ?? "operator",
        );
        return { ...session, needsRegistration };
      }
    }

    if (this.demoPinsEnabled) {
      const demoUser = DEMO_PINS[dto.pin];
      if (demoUser) {
        return this.issueTokenForDemo(
          demoUser.employeeId,
          demoUser.name,
          demoUser.role,
          demoUser.roleId,
        );
      }
    }

    throw new UnauthorizedException("Invalid PIN");
  }

  async getSession(
    employeeId: string,
    name: string,
    role: string,
    roleId?: number,
    appRole?: AppRole,
  ): Promise<AuthSessionData> {
    const { user, canChangePin, needsRegistration } =
      await this.resolveUserProfile(employeeId, name, role, roleId, appRole);
    const permissions = await this.permissionService.resolvePermissions({
      userId: await this.resolveUserIdByCode(employeeId),
      legacyRoleId: roleId,
      legacyRoleName: role,
      appRole: user.appRole,
    });

    return { user, permissions, canChangePin, needsRegistration };
  }

  async changePin(sub: string, dto: ChangePinDto): Promise<AuthSessionResponse> {
    if (!this.prisma.isConnected) {
      throw new BadRequestException("ระบบฐานข้อมูลไม่พร้อมใช้งาน");
    }

    const user = await this.prisma.users.findFirst({
      where: { id_code: sub, is_active: true },
    });
    if (!user) {
      throw new UnauthorizedException("ไม่พบผู้ใช้");
    }

    const valid = await verifyPinAgainstPassword(dto.currentPin, user.password);
    if (!valid) {
      throw new UnauthorizedException("PIN ปัจจุบันไม่ถูกต้อง");
    }

    if (dto.newPin === dto.currentPin) {
      throw new BadRequestException("PIN ใหม่ต้องไม่ซ้ำกับ PIN เดิม");
    }

    assertPinPolicy(dto.newPin);

    const clash = await this.prisma.users.findFirst({
      where: {
        pin_display: dto.newPin,
        is_active: true,
        NOT: { id: user.id },
      },
      select: { id: true },
    });
    if (clash) {
      throw new BadRequestException("PIN นี้ถูกใช้แล้ว กรุณาเลือก PIN อื่น");
    }

    const password = await hashPin(dto.newPin);
    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        pin_display: dto.newPin,
        password,
        updated_at: new Date(),
      },
    });

    const role = user.role_id
      ? await this.prisma.role_configurations.findUnique({
          where: { id: user.role_id },
        })
      : null;

    return this.issueTokenForDbUser(user, role?.role_name ?? "operator");
  }

  async registerPin(employeeId: string, dto: RegisterPinDto) {
    if (!this.prisma.isConnected) {
      throw new BadRequestException("ระบบฐานข้อมูลไม่พร้อมใช้งาน");
    }

    const user = await this.prisma.users.findFirst({
      where: { id_code: employeeId, is_active: true },
    });
    if (!user) {
      throw new NotFoundException("ไม่พบรหัสพนักงานนี้ในระบบ");
    }

    if (user.employee_code !== "NEEDS_REGISTER") {
      throw new BadRequestException("บัญชีนี้ไม่ต้องการลงทะเบียน PIN");
    }

    assertPinPolicy(dto.newPin);

    const clash = await this.prisma.users.findFirst({
      where: {
        pin_display: dto.newPin,
        is_active: true,
        NOT: { id: user.id },
      },
      select: { id: true },
    });
    if (clash) {
      throw new BadRequestException("PIN นี้ถูกใช้แล้ว กรุณาเลือก PIN อื่น");
    }

    const password = await hashPin(dto.newPin);
    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        pin_display: dto.newPin,
        password,
        employee_code: null,
        updated_at: new Date(),
      },
    });

    const role = user.role_id
      ? await this.prisma.role_configurations.findUnique({
          where: { id: user.role_id },
        })
      : null;

    return this.issueTokenForDbUser(user, role?.role_name ?? "operator");
  }

  private async issueTokenForDbUser(
    user: {
      id: number;
      id_code: string;
      name: string;
      role_id: number | null;
      department?: string | null;
      position?: string | null;
      email?: string | null;
      phone?: string | null;
      employee_code?: string | null;
    },
    legacyRoleName: string,
  ): Promise<AuthSessionResponse> {
    const appRole = isTimetrackerOwnAuthEnabled()
      ? ((await this.timetrackerUserRoleService.getAppRoleForUser(user.id)) ??
        (await this.timetrackerUserRoleService.ensureAppRoleForUser(
          user.id,
          legacyRoleName,
        )))
      : mapLegacyRoleNameToAppRole(legacyRoleName);

    const profile = this.buildUserProfile(
      {
        employeeId: user.id_code,
        name: user.name,
        department: user.department,
        position: user.position,
        email: user.email,
        phone: user.phone,
        employee_code: user.employee_code,
      },
      appRole,
      user.role_id ?? undefined,
      legacyRoleName,
    );

    const permissions = await this.permissionService.resolvePermissions({
      userId: user.id,
      legacyRoleId: user.role_id,
      legacyRoleName,
      appRole,
    });

    const token = this.jwt.sign({
      sub: profile.employeeId,
      name: profile.name,
      appRole: profile.appRole,
      role: profile.role,
      roleId: profile.roleId,
    });

    return {
      token,
      user: profile,
      permissions,
      canChangePin: true,
      needsRegistration: user.employee_code === "NEEDS_REGISTER",
    };
  }

  private async issueTokenForDemo(
    employeeId: string,
    name: string,
    legacyRole: string,
    roleId?: number,
  ): Promise<AuthSessionResponse> {
    const appRole = mapLegacyRoleNameToAppRole(legacyRole);
    const profile = this.buildUserProfile(
      { employeeId, name },
      appRole,
      roleId,
      legacyRole,
    );
    const permissions = await this.permissionService.resolvePermissions({
      legacyRoleId: roleId,
      legacyRoleName: legacyRole,
      appRole,
    });

    const token = this.jwt.sign({
      sub: profile.employeeId,
      name: profile.name,
      appRole: profile.appRole,
      role: profile.role,
      roleId: profile.roleId,
    });

    return {
      token,
      user: profile,
      permissions,
      canChangePin: false,
    };
  }

  private async resolveUserProfile(
    employeeId: string,
    fallbackName: string,
    fallbackRole: string,
    fallbackRoleId?: number,
    fallbackAppRole?: AppRole,
  ): Promise<{
    user: AuthUserProfile;
    canChangePin: boolean;
    needsRegistration?: boolean;
  }> {
    if (this.prisma.isConnected) {
      const user = await this.prisma.users.findFirst({
        where: { id_code: employeeId, is_active: true },
      });

      if (user) {
        const role = user.role_id
          ? await this.prisma.role_configurations.findUnique({
              where: { id: user.role_id },
            })
          : null;

        const legacyRoleName = role?.role_name ?? fallbackRole;
        const appRole =
          fallbackAppRole ??
          (isTimetrackerOwnAuthEnabled()
            ? ((await this.timetrackerUserRoleService.getAppRoleForUser(user.id)) ??
              (await this.timetrackerUserRoleService.ensureAppRoleForUser(
                user.id,
                legacyRoleName,
              )))
            : mapLegacyRoleNameToAppRole(legacyRoleName));

        return {
          user: this.buildUserProfile(
            {
              employeeId: user.id_code,
              name: user.name,
              department: user.department,
              position: user.position,
              email: user.email,
              phone: user.phone,
            },
            appRole,
            user.role_id ?? undefined,
            legacyRoleName,
            role?.display_name ?? undefined,
          ),
          canChangePin: true,
          needsRegistration: user.employee_code === "NEEDS_REGISTER",
        };
      }
    }

    const appRole =
      fallbackAppRole ?? mapLegacyRoleNameToAppRole(fallbackRole);

    return {
      user: this.buildUserProfile(
        { employeeId, name: fallbackName },
        appRole,
        fallbackRoleId,
        fallbackRole,
      ),
      canChangePin: false,
    };
  }

  private buildUserProfile(
    base: {
      employeeId: string;
      name: string;
      department?: string | null;
      position?: string | null;
      email?: string | null;
      phone?: string | null;
      employee_code?: string | null;
    },
    appRole: AppRole,
    roleId?: number,
    legacyRoleName?: string,
    legacyDisplayName?: string,
  ): AuthUserProfile {
    return {
      employeeId: base.employeeId,
      name: base.name,
      appRole,
      role: isTimetrackerOwnAuthEnabled()
        ? APP_ROLE_LABELS[appRole]
        : (legacyRoleName ?? APP_ROLE_LABELS[appRole]),
      roleId,
      roleDisplayName: isTimetrackerOwnAuthEnabled()
        ? APP_ROLE_LABELS[appRole]
        : legacyDisplayName,
      department: base.department ?? undefined,
      position: base.position ?? undefined,
      email: base.email ?? undefined,
      phone: base.phone ?? undefined,
      avatarUrl: this.profileAvatarService.hasAvatar(base.employeeId)
        ? "/auth/profile-avatar"
        : undefined,
    };
  }

  private async resolveUserIdByCode(
    employeeId: string,
  ): Promise<number | undefined> {
    if (!this.prisma.isConnected) {
      return undefined;
    }

    const user = await this.prisma.users.findFirst({
      where: { id_code: employeeId, is_active: true },
      select: { id: true },
    });

    return user?.id;
  }
}
