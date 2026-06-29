import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { APP_ROLE_OPTIONS } from "../../../shared/auth/permissions.constants";

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(1)
  idCode!: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  tempPin!: string;

  @ValidateIf((dto: CreateUserDto) => dto.roleId != null)
  @IsInt()
  roleId?: number;

  @ValidateIf((dto: CreateUserDto) => dto.appRole != null)
  @IsString()
  @IsIn(APP_ROLE_OPTIONS)
  appRole?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsInt()
  roleId?: number;

  @IsOptional()
  @IsString()
  @IsIn(APP_ROLE_OPTIONS)
  appRole?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RoleMenuItemDto {
  @IsString()
  menuKey!: string;

  @IsBoolean()
  canView!: boolean;
}

export class UpdateRoleMenusDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => RoleMenuItemDto)
  items!: RoleMenuItemDto[];
}
