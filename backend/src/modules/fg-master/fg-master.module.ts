import { Module } from "@nestjs/common";
import { FgMasterController } from "./fg-master.controller";
import { FgMasterService } from "./fg-master.service";

@Module({
  controllers: [FgMasterController],
  providers: [FgMasterService],
  exports: [FgMasterService],
})
export class FgMasterModule {}
