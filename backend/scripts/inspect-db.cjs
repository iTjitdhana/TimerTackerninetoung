const mysql = require("mysql2/promise");
const { loadEnvFile, buildDatabaseUrl } = require("./load-env.cjs");
const { resolve } = require("path");

loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const tables = [
    "work_plans",
    "work_plan_operators",
    "users",
    "products",
    "materials",
    "production_batches",
    "batch_material_usage",
    "batch_production_results",
    "process_executions",
    "process_steps",
    "product_bom",
    "process_templates",
  ];

  console.log("=== Row counts ===");
  for (const table of tables) {
    const [rows] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${table}\``);
    console.log(`${table}: ${rows[0].cnt}`);
  }

  const timetrackerTables = [
    "ProductionJob",
    "WeighingRecord",
    "ProductionSession",
    "ProductionSummary",
    "EmployeePin",
  ];

  console.log("\n=== TimeTracker tables ===");
  for (const table of timetrackerTables) {
    try {
      const [rows] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${table}\``);
      console.log(`${table}: ${rows[0].cnt} rows`);
    } catch {
      console.log(`${table}: NOT FOUND`);
    }
  }

  console.log("\n=== Latest work_plans (5) ===");
  const [workPlans] = await conn.query(`
    SELECT id, production_date, job_code, job_name, workflow_status, start_time, end_time
    FROM work_plans
    ORDER BY production_date DESC, id DESC
    LIMIT 5
  `);
  console.table(workPlans);

  console.log("\n=== Users with PIN (10) ===");
  const [users] = await conn.query(`
    SELECT id, id_code, name, pin_display, role_id, is_active
    FROM users
    WHERE pin_display IS NOT NULL AND pin_display != ''
    LIMIT 10
  `);
  console.table(users);

  console.log("\n=== Recent production_batches (5) ===");
  const [batches] = await conn.query(`
    SELECT pb.id, pb.work_plan_id, pb.batch_code, pb.status, pb.started_at, pb.completed_at
    FROM production_batches pb
    ORDER BY pb.id DESC
    LIMIT 5
  `);
  console.table(batches);

  await conn.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
