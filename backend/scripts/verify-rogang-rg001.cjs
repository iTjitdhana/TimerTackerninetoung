const { resolve } = require("path");
const mysql = require("mysql2/promise");
const { loadEnvFile, buildDatabaseUrl } = require("./load-env.cjs");

loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

const FG_CODE = "RG001";
const ROGANG_BU_ID = 2;
const EXPECTED_BOM = 7;

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  try {
    const today = new Date().toISOString().slice(0, 10);
    let ok = true;

    const [fgRows] = await connection.query(
      `SELECT FG_Code, FG_Name, FG_Unit, base_unit, conversion_rate
       FROM fg WHERE FG_Code = ?`,
      [FG_CODE],
    );
    console.log("fg:", fgRows[0] ?? null);
    if (!fgRows[0]) ok = false;

    const [bomRows] = await connection.query(
      `SELECT Raw_Code, Raw_Qty, Raw_Unit
       FROM fg_bom WHERE FG_Code = ?
       ORDER BY Raw_Code`,
      [FG_CODE],
    );
    console.log(`fg_bom (${bomRows.length} rows):`, bomRows);
    if (bomRows.length !== EXPECTED_BOM) ok = false;

    const [productRows] = await connection.query(
      `SELECT product_code, product_name, unit, is_active
       FROM products WHERE product_code = ?`,
      [FG_CODE],
    );
    console.log("products:", productRows[0] ?? null);
    if (!productRows[0]) ok = false;

    const [bomCount] = await connection.query(
      `SELECT COUNT(*) AS count FROM fg_bom WHERE FG_Code = ?`,
      [FG_CODE],
    );
    const hasFormula = Number(bomCount[0].count) > 0;
    console.log("hasFormula(RG001):", hasFormula);
    if (!hasFormula) ok = false;

    const [workPlans] = await connection.query(
      `SELECT id, production_date, job_code, job_name, bu_id
       FROM work_plans
       WHERE job_code = ? AND bu_id = ?
       ORDER BY production_date DESC
       LIMIT 5`,
      [FG_CODE, ROGANG_BU_ID],
    );
    console.log("work_plans (ROGANG):", workPlans);

    const [todayRog] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM work_plans
       WHERE production_date = ? AND job_code = ? AND bu_id = ?`,
      [today, FG_CODE, ROGANG_BU_ID],
    );
    console.log(`work_plans today (${today}):`, todayRog[0].count);
    if (Number(todayRog[0].count) === 0) ok = false;

    const [bnlToday] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM work_plans
       WHERE production_date = ? AND job_code = ? AND bu_id = 1`,
      [today, FG_CODE],
    );
    console.log(`work_plans BNL today (should be 0):`, bnlToday[0].count);

    if (!ok) {
      console.error("Verification FAILED");
      process.exit(1);
    }

    console.log("Verification PASSED");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
