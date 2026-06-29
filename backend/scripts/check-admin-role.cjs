const mysql = require("mysql2/promise");
const { loadEnvFile, buildDatabaseUrl } = require("./load-env.cjs");
const { resolve } = require("path");

loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.query(`
    SELECT u.id_code, u.name, u.role_id, rc.role_name, rc.display_name
    FROM users u
    LEFT JOIN role_configurations rc ON rc.id = u.role_id
    WHERE u.id_code = 'admin21133' OR u.name LIKE '%Admin%'
    LIMIT 5
  `);
  console.table(rows);

  const { getPermissionsForRole } = require("../dist/shared/auth/permissions.constants.js");
  for (const row of rows) {
    const perms = getPermissionsForRole(row.role_name ?? "operator");
    console.log(
      row.id_code,
      "role_name=",
      row.role_name,
      "admin_edit=",
      perms.actions.includes("production_timer.admin_edit"),
    );
  }

  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
