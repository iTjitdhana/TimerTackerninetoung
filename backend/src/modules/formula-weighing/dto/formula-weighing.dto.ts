import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class IngredientDto {
  @IsString()
  id!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  quantity!: string;

  @IsString()
  measuredWeight!: string;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsBoolean()
  isManual?: boolean;

  @IsOptional()
  @IsString()
  baseQuantity?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** 'api' = ดึงจาก onhand API, 'manual' = ผู้ใช้คีย์เอง */
  @IsOptional()
  @IsString()
  unitPriceSource?: string;
}

export class CreateWeighingRecordDto {
  @IsString()
  jobId!: string;

  // actor ถูก override จาก JWT ใน controller — ไม่เชื่อค่าจาก client
  @IsOptional()
  @IsString()
  weighedBy?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients!: IngredientDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchCount?: number;
}

export class VerifyWeighingDto {
  @IsString()
  verifiedBy!: string;
}

export class FormulaWeighingJobSettingDto {
  @IsString()
  jobCode!: string;

  @IsString()
  @IsOptional()
  jobName?: string;

  @IsBoolean()
  requiresWeighing!: boolean;
}

export class UpdateFormulaWeighingJobSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormulaWeighingJobSettingDto)
  items!: FormulaWeighingJobSettingDto[];
}
