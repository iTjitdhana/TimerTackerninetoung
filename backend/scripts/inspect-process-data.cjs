const mysql = require("mysql2/promise");
const { loadEnvFile, buildDatabaseUrl } = require("./load-env.cjs");
const { resolve } = require("path");

loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

async function main() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  const [tpl] = await c.query(
    "SELECT product_code, version, process_number, process_description, estimated_duration_minutes FROM process_templates WHERE product_code = '135012' ORDER BY version, process_number LIMIT 10",
  );
  console.log("templates 135012:", tpl);

  const [steps] = await c.query(
    "SELECT job_code, process_number, process_description FROM process_steps WHERE job_code = '135012' ORDER BY process_number LIMIT 10",
  );
  console.log("steps 135012:", steps);

  const [rg] = await c.query(
    "SELECT id, start_time, end_time FROM work_plans WHERE job_code = 'RG001' AND bu_id = 2 LIMIT 3",
  );
  console.log("work_plans RG001:", rg);

  await c.end();
}

main().catch(console.error);
