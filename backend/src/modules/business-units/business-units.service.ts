import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.module";

export interface BusinessUnitDto {
  id: number;
  code: string;
  name: string;
}

@Injectable()
export class BusinessUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<BusinessUnitDto[]> {
    if (!this.prisma.isConnected) {
      return [];
    }

    const rows = await this.prisma.business_units.findMany({
      where: { is_active: true },
      orderBy: [{ id: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    return rows;
  }
}
