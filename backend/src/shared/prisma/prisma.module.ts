import { Global, Injectable, Module, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private connected = false;

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      console.warn("[Prisma] DATABASE_URL not set — running without database");
      return;
    }
    try {
      await this.$connect();
      await this.$executeRawUnsafe(`SET time_zone = '+00:00'`);
      this.connected = true;
    } catch (error) {
      console.warn("[Prisma] Database unavailable — demo auth still works");
      console.warn(error);
    }
  }

  get isConnected() {
    return this.connected;
  }
}

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
