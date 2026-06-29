import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class TimerStepDto {
  @IsString()
  stepName!: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  startTime?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  endTime?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  duration?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class CreateProductionSessionDto {
  @IsString()
  jobId!: string;

  // actor ถูก override จาก JWT ใน controller — ไม่เชื่อค่าจาก client
  @IsOptional()
  @IsString()
  startedBy?: string;
}

export class UpdateProductionSessionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimerStepDto)
  steps!: TimerStepDto[];

  @IsOptional()
  @IsString()
  completedAt?: string;
}

export class AdminTimerStepDto {
  @IsString()
  stepName!: string;

  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== "")
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  startTime?: string;

  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== "")
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class AdminUpdateProductionSessionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminTimerStepDto)
  steps!: AdminTimerStepDto[];

  @IsOptional()
  @IsString()
  completedAt?: string;
}

export class SaveOperatorWeighingDto {
  @IsString()
  materialCode!: string;

  @IsString()
  measuredWeight!: string;

  // actor ถูก override จาก JWT ใน controller — ไม่เชื่อค่าจาก client
  @IsOptional()
  @IsString()
  weighedBy?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}
