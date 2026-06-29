import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.module";

@Injectable()
export class MaterialResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveMaterialId(materialCode: string): Promise<number> {
    return this.resolveOrCreateMaterialId(materialCode);
  }

  async resolveOrCreateMaterialId(
    materialCode: string,
    materialName?: string,
    unit?: string,
  ): Promise<number> {
    const code = materialCode.trim();
    if (!code) {
      throw new BadRequestException("Material code is required");
    }

    const existing = await this.prisma.materials.findUnique({
      where: { material_code: code },
    });

    if (existing) {
      return existing.id;
    }

    const legacy = await this.prisma.material.findUnique({
      where: { Mat_Id: code },
    });

    if (legacy) {
      const created = await this.prisma.materials.create({
        data: {
          material_code: legacy.Mat_Id,
          material_name: legacy.Mat_Name,
          unit: legacy.Mat_Unit,
          price: legacy.price ?? 0,
        },
      });

      return created.id;
    }

    const name = materialName?.trim();
    const materialUnit = unit?.trim();
    if (!name || !materialUnit) {
      throw new NotFoundException(`Material "${code}" not found`);
    }

    const normalizedCode = code.slice(0, 16);
    const normalizedName = name.slice(0, 255);
    const normalizedUnit = materialUnit.slice(0, 64);

    try {
      await this.prisma.material.create({
        data: {
          Mat_Id: normalizedCode,
          Mat_Name: normalizedName,
          Mat_Unit: normalizedUnit,
          price: 0,
        },
      });
    } catch {
      const existingLegacy = await this.prisma.material.findUnique({
        where: { Mat_Id: normalizedCode },
      });
      if (!existingLegacy) {
        throw new BadRequestException(
          `Unable to create material "${normalizedCode}"`,
        );
      }
    }

    try {
      const created = await this.prisma.materials.create({
        data: {
          material_code: normalizedCode,
          material_name: normalizedName,
          unit: normalizedUnit,
          price: 0,
        },
      });
      return created.id;
    } catch {
      const existingMaterial = await this.prisma.materials.findUnique({
        where: { material_code: normalizedCode },
      });
      if (!existingMaterial) {
        throw new BadRequestException(
          `Unable to create material "${normalizedCode}"`,
        );
      }
      return existingMaterial.id;
    }
  }
}
