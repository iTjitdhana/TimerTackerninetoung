import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { WorkplanController } from "./workplan.controller";
import { WorkplanService } from "./workplan.service";
import { MockWorkplanProvider } from "./mock-workplan.provider";
import { HttpWorkplanProvider } from "./http-workplan.provider";
import { DbWorkplanProvider } from "./db-workplan.provider";
import { WORKPLAN_PROVIDER } from "./workplan.interface";

@Module({
  imports: [AuthModule],
  controllers: [WorkplanController],
  providers: [
    WorkplanService,
    MockWorkplanProvider,
    HttpWorkplanProvider,
    DbWorkplanProvider,
    {
      provide: WORKPLAN_PROVIDER,
      inject: [ConfigService, MockWorkplanProvider, HttpWorkplanProvider, DbWorkplanProvider],
      useFactory: (
        config: ConfigService,
        mock: MockWorkplanProvider,
        http: HttpWorkplanProvider,
        db: DbWorkplanProvider,
      ) => {
        const provider = config.get<string>("WORKPLAN_PROVIDER", "db");
        if (provider === "http") return http;
        if (provider === "mock") return mock;
        return db;
      },
    },
  ],
  exports: [WorkplanService, WORKPLAN_PROVIDER, DbWorkplanProvider],
})
export class WorkplanModule {}
