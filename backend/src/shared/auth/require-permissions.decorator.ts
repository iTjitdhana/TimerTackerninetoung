import { SetMetadata } from "@nestjs/common";
import type { ActionKey } from "./permissions.constants";

export const PERMISSIONS_KEY = "permissions";

export const RequirePermissions = (...permissions: ActionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
