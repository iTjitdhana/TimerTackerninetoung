import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { RequestWithUser } from "./jwt-auth.guard";
import type { AuthenticatedRequestUser } from "./auth-user.types";

/**
 * ดึงผู้ใช้ที่ผ่าน JwtAuthGuard มาแล้วจาก request
 * ใช้สำหรับผูก actor ของ action (เช่น weighedBy/startedBy) กับตัวตนจริงใน JWT
 * แทนที่จะเชื่อค่าที่ client ส่งมาใน body (กัน audit spoofing)
 */
export const CurrentUser = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): AuthenticatedRequestUser | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
