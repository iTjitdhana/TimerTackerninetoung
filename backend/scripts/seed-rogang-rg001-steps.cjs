const { resolve } = require("path");
const mysql = require("mysql2/promise");
const { loadEnvFile, buildDatabaseUrl } = require("./load-env.cjs");

loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

const FG_CODE = "RG001";
const FG_NAME = "กุ้งผัดผงกระหรี่ + หมูปั้น + ข้าวสวย";
const ROGANG_BU_ID = 2;
const TEMPLATE_VERSION = 1;
const TEST_NOTE = "ทดสอบระบบ";

const STEPS = [
  {
    number: 1,
    description: "เตรียมอุปกรณ์และวัตถุดิบ",
    start: "05:00:00",
    end: "05:45:00",
    minutes: 45,
  },
  {
    number: 2,
    description: "ประกอบอาหาร",
    start: "05:45:00",
    end: "07:45:00",
    minutes: 120,
  },
  {
    number: 3,
    description: "แพ็ค",
    start: "07:45:00",
    end: "08:30:00",
    minutes: 45,
  },
  {
    number: 4,
    description: "เก็บล้างอุปกรณ์และพื้นที่",
    start: "08:30:00",
    end: "09:00:00",
    minutes: 30,
  },
];

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

async function replaceProcessTemplates(connection) {
  await connection.query(
    `DELETE FROM process_templates WHERE product_code = ? AND version = ?`,
    [FG_CODE, TEMPLATE_VERSION],
  );

  for (const step of STEPS) {
    await connection.query(
      `INSERT INTO process_templates (
         product_code, version, process_number, process_description,
         estimated_duration_minutes, notes, is_active
       ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        FG_CODE,
        TEMPLATE_VERSION,
        step.number,
        step.description,
        step.minutes,
        step.number === 1 ? TEST_NOTE : null,
      ],
    );
  }
}

async function replaceProcessSteps(connection, dateRecorded) {
  await connection.query(`DELETE FROM process_steps WHERE job_code = ?`, [
    FG_CODE,
  ]);

  for (const step of STEPS) {
    await connection.query(
      `INSERT INTO process_steps (
         job_code, job_name, date_recorded, process_number, process_description, worker_count
       ) VALUES (?, ?, ?, ?, ?, 1)`,
      [FG_CODE, FG_NAME, dateRecorded, step.number, step.description],
    );
  }
}

async function upsertActiveVersion(connection) {
  await connection.query(
    `INSERT INTO product_active_versions (product_code, active_version, note)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       active_version = VALUES(active_version),
       note = VALUES(note),
       updated_at = CURRENT_TIMESTAMP`,
    [FG_CODE, TEMPLATE_VERSION, TEST_NOTE],
  );
}

async function updateWorkPlanSchedule(connection) {
  await connection.query(
    `UPDATE work_plans
     SET start_time = '05:00:00',
         end_time = '09:00:00',
         notes = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE job_code = ? AND bu_id = ?`,
    [TEST_NOTE, FG_CODE, ROGANG_BU_ID],
  );
}

async function seedTestLogs(connection, workPlanId, productionDate) {
  await connection.query(`DELETE FROM logs WHERE work_plan_id = ?`, [
    workPlanId,
  ]);

  for (const step of STEPS) {
    await connection.query(
      `INSERT INTO logs (work_plan_id, process_number, status, timestamp)
       VALUES (?, ?, 'start', ?)`,
      [
        workPlanId,
        step.number,
        `${productionDate} ${step.start}`,
      ],
    );
    await connection.query(
      `INSERT INTO logs (work_plan_id, process_number, status, timestamp)
       VALUES (?, ?, 'stop', ?)`,
      [workPlanId, step.number, `${productionDate} ${step.end}`],
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

  const today = formatDate(new Date());

  try {
    await connection.beginTransaction();

    await replaceProcessTemplates(connection);
    await replaceProcessSteps(connection, today);
    await upsertActiveVersion(connection);
    await updateWorkPlanSchedule(connection);

    const [workPlans] = await connection.query(
      `SELECT id, production_date
       FROM work_plans
       WHERE job_code = ? AND bu_id = ?
       ORDER BY production_date ASC`,
      [FG_CODE, ROGANG_BU_ID],
    );

    for (const plan of workPlans) {
      const dateStr = formatDate(new Date(plan.production_date));
      await seedTestLogs(connection, plan.id, dateStr);
    }

    await connection.commit();

    console.log(`Seeded ${STEPS.length} process steps for ${FG_CODE}`);
    console.log("Schedule: 05:00 - 09:00");
    for (const step of STEPS) {
      console.log(
        `  ${step.number}. ${step.description} (${step.start.slice(0, 5)}-${step.end.slice(0, 5)}, ${step.minutes} นาที)`,
      );
    }
    console.log(`Updated ${workPlans.length} work plan(s) with test logs`);
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
