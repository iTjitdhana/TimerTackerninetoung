import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BatchResolverService } from "./services/batch-resolver.service";
import { BomService } from "./services/bom.service";
import { JobAccessService } from "./services/job-access.service";
import { MaterialResolverService } from "./services/material-resolver.service";
import { OnhandCostPriceService } from "./services/onhand-cost-price.service";
import { ProcessStepsReaderService } from "./services/process-steps-reader.service";
import { ProcessTemplatesReaderService } from "./services/process-templates-reader.service";
import { ProductionLogService } from "./services/production-log.service";
import { UserResolverService } from "./services/user-resolver.service";
import { BOM_SOURCE_PROVIDER } from "./services/bom-source/bom-source.interface";
import { DbBomSourceProvider } from "./services/bom-source/db-bom-source.provider";
import { HttpBomSourceProvider } from "./services/bom-source/http-bom-source.provider";

@Global()
@Module({
  providers: [
    BatchResolverService,
    BomService,
    JobAccessService,
    MaterialResolverService,
    OnhandCostPriceService,
    ProcessStepsReaderService,
    ProcessTemplatesReaderService,
    ProductionLogService,
    UserResolverService,
    DbBomSourceProvider,
    HttpBomSourceProvider,
    {
      provide: BOM_SOURCE_PROVIDER,
      inject: [ConfigService, DbBomSourceProvider, HttpBomSourceProvider],
      useFactory: (
        config: ConfigService,
        db: DbBomSourceProvider,
        http: HttpBomSourceProvider,
      ) => {
        const provider = config.get<string>("BOM_PROVIDER", "db");
        return provider === "http" ? http : db;
      },
    },
  ],
  exports: [
    BatchResolverService,
    BomService,
    JobAccessService,
    MaterialResolverService,
    OnhandCostPriceService,
    ProcessStepsReaderService,
    ProcessTemplatesReaderService,
    ProductionLogService,
    UserResolverService,
    BOM_SOURCE_PROVIDER,
  ],
})
export class SharedModule {}
