const mysql = require("mysql2/promise");
const { loadEnvFile, buildDatabaseUrl } = require("./load-env.cjs");
const { resolve } = require("path");

loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const [jobs] = await conn.query(
    `SELECT id, production_date, job_code, job_name, workflow_status, start_time, end_time
     FROM work_plans
     WHERE production_date = ?
     ORDER BY start_time ASC
     LIMIT 5`,
    ["2026-05-22"],
  );

  const [users] = await conn.query(
    `SELECT id_code, name, pin_display
     FROM users
     WHERE pin_display IS NOT NULL AND pin_display != '' AND is_active = 1
     LIMIT 3`,
  );

  console.log("jobs_sample", JSON.stringify(jobs, null, 2));
  console.log("users_with_pin", JSON.stringify(users, null, 2));
  await conn.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
