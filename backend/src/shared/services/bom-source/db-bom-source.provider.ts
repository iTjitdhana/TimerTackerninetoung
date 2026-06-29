import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.module";
import type { BomFormula, BomSourceProvider } from "./bom-source.interface";

@Injectable()
export class DbBomSourceProvider implements BomSourceProvider {
  constructor(private readonly prisma: PrismaService) {}

  async getFormula(fgCode: string): Promise<BomFormula | null> {
    const bomRows = await this.prisma.fg_bom.findMany({
      where: { FG_Code: fgCode },
      orderBy: { id: "asc" },
    });

    if (bomRows.length === 0) {
      return null;
    }

    return {
      fgCode,
      components: bomRows.map((row, index) => ({
        rawCode: row.Raw_Code,
        rawQty: row.Raw_Qty,
        rawUnit: row.Raw_Unit,
        lineOrder: index + 1,
      })),
    };
  }
}
