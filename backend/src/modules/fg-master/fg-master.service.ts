import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../shared/prisma/prisma.module";
import {
  parseOutputVariantsFromDescription,
  resolveProductOutput,
  type ProductOutputConfig,
} from "../../shared/utils/output-quantity.util";
import { serializeForJson } from "../../shared/utils/json-serialize.util";
import { UpdateFgMasterDto } from "./dto/fg-master.dto";

export interface FgMasterListItem {
  fgCode: string;
  fgName: string;
  fgUnit: string;
  fgSize: string;
  conversionRate: number;
  baseUnit: string | null;
  conversionVerified: boolean;
}

export interface FgMasterDetail extends FgMasterListItem {
  conversionDescription: string | null;
  outputConfig: ProductOutputConfig;
}

function toNumber(
  value: Prisma.Decimal | number | string | null | undefined,
): number {
  if (value == null) return 1;
  if (typeof value === "object" && "toNumber" in value) {
    return value.toNumber();
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 1;
}

function mapFgRow(
  row: {
    FG_Code: string;
    FG_Name: string;
    FG_Unit: string;
    FG_Size: string;
    base_unit: string | null;
    conversion_rate: Prisma.Decimal | null;
    conversion_description?: string | null;
  },
  outputConfig?: ProductOutputConfig,
): FgMasterListItem {
  const config =
    outputConfig ??
    resolveProductOutput(
      {
        FG_Unit: row.FG_Unit,
        conversion_rate: row.conversion_rate,
        base_unit: row.base_unit,
        FG_Size: row.FG_Size,
        conversion_description: row.conversion_description ?? null,
      },
      undefined,
      { fgCode: row.FG_Code },
    );

  return {
    fgCode: row.FG_Code,
    fgName: row.FG_Name,
    fgUnit: row.FG_Unit,
    fgSize: row.FG_Size,
    conversionRate: toNumber(row.conversion_rate),
    baseUnit: row.base_unit,
    conversionVerified: config.conversionVerified,
  };
}

@Injectable()
export class FgMasterService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: string, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 200);
    const term = q?.trim();

    const rows = await this.prisma.fg.findMany({
      where: term
        ? {
            OR: [
              { FG_Code: { contains: term } },
              { FG_Name: { contains: term } },
            ],
          }
        : undefined,
      orderBy: [{ FG_Code: "asc" }],
      take,
      select: {
        FG_Code: true,
        FG_Name: true,
        FG_Unit: true,
        FG_Size: true,
        base_unit: true,
        conversion_rate: true,
        conversion_description: true,
      },
    });

    return serializeForJson({
      items: rows.map((row) => mapFgRow(row)),
      total: rows.length,
    });
  }

  async getByCode(fgCode: string): Promise<FgMasterDetail> {
    const row = await this.prisma.fg.findUnique({
      where: { FG_Code: fgCode.trim() },
    });

    if (!row) {
      throw new NotFoundException(`FG "${fgCode}" not found`);
    }

    const outputConfig = resolveProductOutput(row, undefined, {
      fgCode: row.FG_Code,
    });

    return serializeForJson({
      ...mapFgRow(row, outputConfig),
      conversionDescription: row.conversion_description,
      outputConfig,
    });
  }

  async update(fgCode: string, dto: UpdateFgMasterDto): Promise<FgMasterDetail> {
    const code = fgCode.trim();
    const existing = await this.prisma.fg.findUnique({
      where: { FG_Code: code },
    });

    if (!existing) {
      throw new NotFoundException(`FG "${fgCode}" not found`);
    }

    if (dto.conversionDescription !== undefined && dto.conversionDescription !== null) {
      const trimmed = dto.conversionDescription.trim();
      if (trimmed) {
        const parsed = parseOutputVariantsFromDescription(trimmed);
        if (!parsed) {
          throw new BadRequestException(
            "conversionDescription ต้องเป็น JSON array ของ output variants ที่ถูกต้อง",
          );
        }
      }
    }

    const data: Prisma.fgUpdateInput = {};
    if (dto.fgUnit !== undefined) data.FG_Unit = dto.fgUnit.trim();
    if (dto.fgSize !== undefined) data.FG_Size = dto.fgSize.trim();
    if (dto.conversionRate !== undefined) {
      data.conversion_rate = dto.conversionRate;
    }
    if (dto.baseUnit !== undefined) data.base_unit = dto.baseUnit.trim();
    if (dto.conversionDescription !== undefined) {
      const trimmed = dto.conversionDescription?.trim();
      data.conversion_description = trimmed || null;
    }

    const row = await this.prisma.fg.update({
      where: { FG_Code: code },
      data,
    });

    const outputConfig = resolveProductOutput(row, undefined, {
      fgCode: row.FG_Code,
    });

    return serializeForJson({
      ...mapFgRow(row, outputConfig),
      conversionDescription: row.conversion_description,
      outputConfig,
    });
  }
}
