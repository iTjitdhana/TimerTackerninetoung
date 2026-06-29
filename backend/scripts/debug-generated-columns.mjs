import { NestFactory } from "@nestjs/core";
import { AppModule } from "../dist/app.module.js";

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  const { PrismaService } = await import("../dist/shared/prisma/prisma.module.js");
  const prisma = app.get(PrismaService);

  const rows = await prisma.$queryRawUnsafe(`
    SELECT COLUMN_NAME, GENERATION_EXPRESSION, EXTRA
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('batch_production_results', 'production_costs')
      AND EXTRA LIKE '%GENERATED%'
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);

  console.log(JSON.stringify(rows, null, 2));
} finally {
  await app.close();
}
