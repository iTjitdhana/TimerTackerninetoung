/**
 * Move all Rogang (RG*) work plans from one production_date to another.
 *
 * Usage:
 *   node scripts/move-rogang-date.cjs
 *   node scripts/move-rogang-date.cjs --from=2026-06-02 --to=2026-06-01
 */
const { resolve } = require("path");
const mysql = require("mysql2/promise");
const { loadEnvFile, buildDatabaseUrl } = require("./load-env.cjs");

loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

const ROGANG_BU_ID = 2;

function parseArg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const FROM_DATE = parseArg("from", "2026-06-02");
const TO_DATE = parseArg("to", "2026-06-01");

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    const [before] = await connection.query(
      `SELECT id, production_date, job_code, job_name
       FROM work_plans
       WHERE bu_id = ? AND job_code LIKE 'RG%' AND production_date = ?
       ORDER BY job_code ASC`,
      [ROGANG_BU_ID, FROM_DATE],
    );

    if (before.length === 0) {
      console.log(`No RG work plans on ${FROM_DATE} (bu_id=${ROGANG_BU_ID})`);
      return;
    }

    console.log(`Moving ${before.length} work plan(s): ${FROM_DATE} → ${TO_DATE}`);
    console.table(before);

    const [conflicts] = await connection.query(
      `SELECT job_code, id
       FROM work_plans
       WHERE bu_id = ? AND job_code LIKE 'RG%' AND production_date = ?`,
      [ROGANG_BU_ID, TO_DATE],
    );

    if (conflicts.length > 0) {
      console.warn(`Warning: ${conflicts.length} RG plan(s) already on ${TO_DATE}:`);
      console.table(conflicts);
      throw new Error("Target date already has RG jobs — resolve conflicts first");
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `UPDATE work_plans
       SET production_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE bu_id = ? AND job_code LIKE 'RG%' AND production_date = ?`,
      [TO_DATE, ROGANG_BU_ID, FROM_DATE],
    );

    await connection.commit();

    const [after] = await connection.query(
      `SELECT id, production_date, job_code, job_name
       FROM work_plans
       WHERE bu_id = ? AND job_code LIKE 'RG%' AND production_date = ?
       ORDER BY job_code ASC`,
      [ROGANG_BU_ID, TO_DATE],
    );

    console.log(`Updated ${result.affectedRows} row(s).`);
    console.table(after);
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
