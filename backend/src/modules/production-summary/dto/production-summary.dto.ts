import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class ProductionOutputLineDto {
  @IsIn(["sellable", "scrap"])
  kind!: "sellable" | "scrap";

  @IsString()
  label!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  qty!: number;

  @IsString()
  unit!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  conversionRate!: number;
}

export class CreateProductionSummaryDto {
  @IsString()
  jobId!: string;

  @IsNumber()
  outputQty!: number;

  @IsOptional()
  @IsString()
  outputUnit?: string;

  @IsOptional()
  @IsNumber()
  scrapQty?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductionOutputLineDto)
  outputLines?: ProductionOutputLineDto[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyWagePerPerson!: number;
}
