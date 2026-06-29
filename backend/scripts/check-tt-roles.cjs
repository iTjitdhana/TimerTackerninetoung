require("./load-env.cjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe(
    "SHOW TABLES LIKE 'timetracker_user_roles'",
  );
  const count = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS cnt FROM timetracker_user_roles",
  );
  const byRole = await prisma.$queryRawUnsafe(
    "SELECT app_role, COUNT(*) AS cnt FROM timetracker_user_roles GROUP BY app_role ORDER BY app_role",
  );
  const legacyRoles = await prisma.$queryRawUnsafe(
    "SELECT id, role_name, display_name FROM role_configurations ORDER BY id",
  );

  console.log("table_exists:", tables.length > 0);
  console.log("total_rows:", String(count[0]?.cnt ?? 0));
  console.log("by_role:", JSON.stringify(byRole, (_k, v) => typeof v === "bigint" ? String(v) : v));
  console.log("legacy_roles:", JSON.stringify(legacyRoles));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
