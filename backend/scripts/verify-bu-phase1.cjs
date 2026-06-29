const mysql = require("mysql2/promise");
const { loadEnvFile, buildDatabaseUrl } = require("./load-env.cjs");
const { resolve } = require("path");

loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  try {
    const [units] = await connection.query(
      "SELECT id, code, name FROM business_units ORDER BY id",
    );
    console.log("business_units:", units);

    const [bnlCount] = await connection.query(
      "SELECT COUNT(*) AS count FROM work_plans WHERE bu_id = 1",
    );
    const [rogangCount] = await connection.query(
      "SELECT COUNT(*) AS count FROM work_plans WHERE bu_id = 2",
    );
    const [nullBuCount] = await connection.query(
      "SELECT COUNT(*) AS count FROM work_plans WHERE bu_id IS NULL",
    );

    console.log("work_plans BNL:", bnlCount[0].count);
    console.log("work_plans ROGANG:", rogangCount[0].count);
    console.log("work_plans NULL bu_id:", nullBuCount[0].count);

    const today = new Date().toISOString().slice(0, 10);
    const [bnlJobsToday] = await connection.query(
      "SELECT COUNT(*) AS count FROM work_plans WHERE production_date = ? AND bu_id = 1",
      [today],
    );
    const [rogangJobsToday] = await connection.query(
      "SELECT COUNT(*) AS count FROM work_plans WHERE production_date = ? AND bu_id = 2",
      [today],
    );
    console.log(`jobs today (${today}) BNL:`, bnlJobsToday[0].count);
    console.log(`jobs today (${today}) ROGANG:`, rogangJobsToday[0].count);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
