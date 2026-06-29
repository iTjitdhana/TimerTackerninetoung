import { Type } from "class-transformer";
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateFgMasterDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  fgUnit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fgSize?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  conversionRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  baseUnit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  conversionDescription?: string | null;
}
