const { resolve } = require("path");
const mysql = require("mysql2/promise");
const { loadEnvFile, buildDatabaseUrl } = require("./load-env.cjs");

loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

const FG_CODE = "RG001";
const ROGANG_BU_ID = 2;
const NEW_DATE = "2026-05-27";

const STEP_TIMES = [
  { number: 1, start: "05:00:00", end: "05:45:00" },
  { number: 2, start: "05:45:00", end: "07:45:00" },
  { number: 3, start: "07:45:00", end: "08:30:00" },
  { number: 4, start: "08:30:00", end: "09:00:00" },
];

async function reseedLogs(connection, workPlanId) {
  await connection.query(`DELETE FROM logs WHERE work_plan_id = ?`, [workPlanId]);

  for (const step of STEP_TIMES) {
    await connection.query(
      `INSERT INTO logs (work_plan_id, process_number, status, timestamp)
       VALUES (?, ?, 'start', ?)`,
      [workPlanId, step.number, `${NEW_DATE} ${step.start}`],
    );
    await connection.query(
      `INSERT INTO logs (work_plan_id, process_number, status, timestamp)
       VALUES (?, ?, 'stop', ?)`,
      [workPlanId, step.number, `${NEW_DATE} ${step.end}`],
    );
  }
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  try {
    await connection.beginTransaction();

    const [plans] = await connection.query(
      `SELECT id, production_date
       FROM work_plans
       WHERE job_code = ? AND bu_id = ?
       ORDER BY id ASC`,
      [FG_CODE, ROGANG_BU_ID],
    );

    if (plans.length === 0) {
      throw new Error(`No work plans found for ${FG_CODE} bu_id=${ROGANG_BU_ID}`);
    }

    const keepId = plans[0].id;
    const duplicateIds = plans.slice(1).map((p) => p.id);

    await connection.query(
      `UPDATE work_plans
       SET production_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [NEW_DATE, keepId],
    );

    if (duplicateIds.length > 0) {
      await connection.query(
        `DELETE FROM logs WHERE work_plan_id IN (?)`,
        [duplicateIds],
      );
      await connection.query(`DELETE FROM work_plans WHERE id IN (?)`, [
        duplicateIds,
      ]);
    }

    await reseedLogs(connection, keepId);

    await connection.commit();

    console.log(`Updated work plan id=${keepId} to ${NEW_DATE}`);
    if (duplicateIds.length > 0) {
      console.log(`Removed duplicate work plan id(s): ${duplicateIds.join(", ")}`);
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
