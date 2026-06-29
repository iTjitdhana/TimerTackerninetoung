import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.module";

@Injectable()
export class UserResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveUserId(nameOrIdCode: string | null | undefined): Promise<number> {
    const identifier = nameOrIdCode?.trim();
    if (!identifier) {
      throw new BadRequestException("Missing actor identity");
    }

    const user = await this.prisma.users.findFirst({
      where: {
        OR: [{ id_code: identifier }, { name: identifier }],
        is_active: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User "${identifier}" not found`);
    }

    return user.id;
  }
}
