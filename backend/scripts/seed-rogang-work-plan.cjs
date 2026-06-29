/**
 * Seed / update Rogang (โรงแกง) work plans.
 *
 * Usage:
 *   node scripts/seed-rogang-work-plan.cjs
 *
 * Add menu names to COOK_JOBS or PACK_JOBS — steps are fixed per group.
 */
const { resolve } = require("path");
const mysql = require("mysql2/promise");
const { loadEnvFile, buildDatabaseUrl } = require("./load-env.cjs");

loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

const ROGANG_BU_ID = 2;
const PRODUCTION_DATE = "2026-06-01";
const TEMPLATE_VERSION = 1;
const SCHEDULE_START = "05:00:00";
const SCHEDULE_END = "09:00:00";

const DEFAULT_OPERATOR = {
  userId: 20,
  idCode: "sorn",
  name: "พี่สร",
};

const PACK_STEPS = [{ number: 1, description: "แพ็ค" }];
const COOK_ONLY_STEPS = [{ number: 1, description: "ประกอบอาหาร" }];
const COOK_AND_PACK_STEPS = [
  { number: 1, description: "ประกอบอาหาร" },
  { number: 2, description: "แพ็ค" },
];

/** เมนูประกอบอาหาร — ประกอบอาหาร + แพ็ค (กำหนด steps เองได้ถ้าต้องการต่างจาก default) */
const COOK_JOBS = [
  { jobCode: "RG001", jobName: "แกงส้มกุ้ง" },
  { jobCode: "RG002", jobName: "แพนงไก่" },
  { jobCode: "RG003", jobName: "ไก่ผัดฉ่า" },
  { jobCode: "RG004", jobName: "หมูทอดกระเทียม" },
  { jobCode: "RG005", jobName: "บล็อคโคลี่ผัดหมู" },
  { jobCode: "RG006", jobName: "ต้มจับฉ่าย" },
  { jobCode: "RG007", jobName: "มะเขือยาวผัดหมูสับ" },
  { jobCode: "RG008", jobName: "ไข่ดาว" },
  { jobCode: "RG009", jobName: "ไข่เจียว" },
  { jobCode: "RG010", jobName: "ไข่ต้ม" },
  { jobCode: "RG011", jobName: "กุ้งลวก" },
  { jobCode: "RG018", jobName: "ทอดหมูปั้น", outputUnit: "ชิ้น" },
  {
    jobCode: "RG020",
    jobName: "สสวก",
    steps: COOK_ONLY_STEPS,
    stepNote: "ประกอบอาหาร",
    outputUnit: "กก.",
  },
  {
    jobCode: "RG021",
    jobName: "หมูผัดเค็มทอด",
    outputUnit: "กก.",
  },
  {
    jobCode: "RG022",
    jobName: "ผัดผงกระหรี่",
    outputUnit: "กก.",
  },
];

/** เมนูแพ็ค — 1 ขั้นตอน */
const PACK_JOBS = [
  { jobCode: "RG012", jobName: "กุ้งผัดผงกะหรี่+ทอด" },
  { jobCode: "RG013", jobName: "กุ้งผัดผงกะหรี่+หมูปั้นก้อน" },
  { jobCode: "RG014", jobName: "แพนงไก่+ไข่เจียว" },
  { jobCode: "RG015", jobName: "ไก่ผัดฉ่า+ไข่เจียว" },
  { jobCode: "RG016", jobName: "หมูทอดกระเทียม+ไข่ดาว" },
  { jobCode: "RG017", jobName: "บล็อคโคลี่ผัดหมู+ไข่เจียว" },
  { jobCode: "RG019", jobName: "แพ็คข้าวลงกล่อง" },
];

const JOBS = [
  ...COOK_JOBS.map((job) => ({
    ...job,
    steps: job.steps ?? COOK_AND_PACK_STEPS,
    stepNote: job.stepNote ?? "ประกอบอาหาร + แพ็ค",
    outputUnit: job.outputUnit ?? "กล่อง",
  })),
  ...PACK_JOBS.map((job) => ({
    ...job,
    steps: PACK_STEPS,
    stepNote: "แพ็ค",
    outputUnit: "กล่อง",
  })),
];

async function replaceProcessTemplates(connection, productCode, steps, stepNote) {
  for (const step of steps) {
    await connection.query(
      `INSERT INTO process_templates (
         product_code, version, process_number, process_description, is_active
       ) VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         process_description = VALUES(process_description),
         is_active = 1,
         updated_at = CURRENT_TIMESTAMP`,
      [productCode, TEMPLATE_VERSION, step.number, step.description],
    );
  }

  await connection.query(
    `INSERT INTO product_active_versions (product_code, active_version, note)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       active_version = VALUES(active_version),
       note = VALUES(note),
       updated_at = CURRENT_TIMESTAMP`,
    [productCode, TEMPLATE_VERSION, `โรงแกง — ${stepNote}`],
  );

  const activeNumbers = steps.map((step) => step.number);
  await connection.query(
    `UPDATE process_templates
     SET is_active = 0, updated_at = CURRENT_TIMESTAMP
     WHERE product_code = ? AND version = ? AND process_number NOT IN (?)`,
    [productCode, TEMPLATE_VERSION, activeNumbers],
  );
}

async function replaceProcessSteps(connection, productCode, jobName, steps) {
  const today = new Date().toISOString().slice(0, 10);
  await connection.query(`DELETE FROM process_steps WHERE job_code = ?`, [
    productCode,
  ]);

  for (const step of steps) {
    await connection.query(
      `INSERT INTO process_steps (
         job_code, job_name, date_recorded, process_number, process_description, worker_count
       ) VALUES (?, ?, ?, ?, ?, 1)`,
      [productCode, jobName, today, step.number, step.description],
    );
  }
}

async function ensureFgAndProduct(connection, jobCode, jobName, outputUnit = "กล่อง") {
  let fgUnit;
  let fgSize;
  let conversionRate;
  let conversionDescription;

  if (outputUnit === "ชิ้น") {
    const pieceWeightKg = 0.04;
    fgUnit = "ชิ้น";
    fgSize = "1 ชิ้น (40 กรัม)";
    conversionRate = pieceWeightKg;
    conversionDescription = `1 ชิ้น = ${pieceWeightKg} กก. (40 กรัม)`;
  } else if (outputUnit === "กก.") {
    fgUnit = "กก.";
    fgSize = "1 กก.";
    conversionRate = 1;
    conversionDescription = "1 กก.";
  } else {
    fgUnit = "กล่อง";
    fgSize = "420 กรัม/กล่อง";
    conversionRate = 0.42;
    conversionDescription = "1 กล่อง = 0.42 กก. (420 กรัม)";
  }

  await connection.query(
    `INSERT INTO fg (
       FG_Code, FG_Name, FG_Unit, FG_Size, base_unit, conversion_rate, conversion_description
     ) VALUES (?, ?, ?, ?, 'กก.', ?, ?)
     ON DUPLICATE KEY UPDATE
       FG_Name = VALUES(FG_Name),
       FG_Unit = VALUES(FG_Unit),
       FG_Size = VALUES(FG_Size),
       conversion_rate = VALUES(conversion_rate),
       conversion_description = VALUES(conversion_description),
       updated_at = CURRENT_TIMESTAMP`,
    [jobCode, jobName, fgUnit, fgSize, conversionRate, conversionDescription],
  );
  await connection.query(
    `INSERT INTO products (
       product_code, product_name, product_type, unit, is_active
     ) VALUES (?, ?, 'FG', ?, 1)
     ON DUPLICATE KEY UPDATE
       product_name = VALUES(product_name),
       unit = VALUES(unit),
       is_active = VALUES(is_active),
       updated_at = CURRENT_TIMESTAMP`,
    [jobCode, jobName.slice(0, 100), fgUnit],
  );
}

async function syncProductNames(connection, jobCode, jobName) {
  await connection.query(
    `UPDATE fg SET FG_Name = ?, updated_at = CURRENT_TIMESTAMP WHERE FG_Code = ?`,
    [jobName, jobCode],
  );
  await connection.query(
    `UPDATE products SET product_name = ?, updated_at = CURRENT_TIMESTAMP WHERE product_code = ?`,
    [jobName.slice(0, 100), jobCode],
  );
}

async function findWorkPlan(connection, productionDate, jobCode) {
  const [rows] = await connection.query(
    `SELECT id FROM work_plans
     WHERE production_date = ? AND job_code = ? AND bu_id = ?
     LIMIT 1`,
    [productionDate, jobCode, ROGANG_BU_ID],
  );
  return rows[0] ?? null;
}

async function upsertWorkPlan(connection, job) {
  const existing = await findWorkPlan(connection, PRODUCTION_DATE, job.jobCode);

  if (existing) {
    await connection.query(
      `UPDATE work_plans
       SET job_name = ?, bu_id = ?, start_time = ?, end_time = ?,
           workflow_status = 'draft', status_id = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [job.jobName, ROGANG_BU_ID, SCHEDULE_START, SCHEDULE_END, existing.id],
    );
    return { id: existing.id, action: "updated" };
  }

  const [result] = await connection.query(
    `INSERT INTO work_plans (
       production_date, job_code, job_name, job_type, status_id, workflow_status, bu_id,
       start_time, end_time
     ) VALUES (?, ?, ?, 'regular', 1, 'draft', ?, ?, ?)`,
    [
      PRODUCTION_DATE,
      job.jobCode,
      job.jobName,
      ROGANG_BU_ID,
      SCHEDULE_START,
      SCHEDULE_END,
    ],
  );

  return { id: result.insertId, action: "created" };
}

async function assignOperator(connection, workPlanId, operator) {
  await connection.query(
    `DELETE FROM work_plan_operators WHERE work_plan_id = ?`,
    [workPlanId],
  );
  await connection.query(
    `INSERT INTO work_plan_operators (work_plan_id, user_id, id_code, role)
     VALUES (?, ?, ?, 'operator')`,
    [workPlanId, operator.userId, operator.idCode],
  );
}

async function findTemplateId(connection, productCode, processNumber) {
  const [rows] = await connection.query(
    `SELECT id FROM process_templates
     WHERE product_code = ? AND version = ? AND process_number = ? AND is_active = 1
     LIMIT 1`,
    [productCode, TEMPLATE_VERSION, processNumber],
  );
  return rows[0]?.id ?? null;
}

/** Keep recorded timestamps; add missing steps; drop only empty obsolete steps */
async function syncProcessExecutions(connection, workPlanId, batchId, jobCode, steps) {
  if (!batchId) return { added: 0, kept: 0, removed: 0 };

  const [existing] = await connection.query(
    `SELECT id, process_number, start_time, end_time
     FROM process_executions WHERE work_plan_id = ?`,
    [workPlanId],
  );

  const desiredNumbers = new Set(steps.map((step) => step.number));
  const byNumber = new Map(existing.map((row) => [row.process_number, row]));
  let added = 0;
  let kept = 0;
  let removed = 0;

  for (const step of steps) {
    const row = byNumber.get(step.number);
    if (row) {
      await connection.query(
        `UPDATE process_executions
         SET process_description = ?, product_code = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [step.description, jobCode, row.id],
      );
      kept += 1;
      continue;
    }

    const templateId = await findTemplateId(connection, jobCode, step.number);
    if (!templateId) {
      throw new Error(
        `Missing process template for ${jobCode} step ${step.number}`,
      );
    }

    await connection.query(
      `INSERT INTO process_executions (
         work_plan_id, batch_id, template_id, product_code,
         process_number, process_description, status
       ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [
        workPlanId,
        batchId,
        templateId,
        jobCode,
        step.number,
        step.description,
      ],
    );
    added += 1;
  }

  for (const row of existing) {
    if (desiredNumbers.has(row.process_number)) continue;
    if (row.start_time || row.end_time) continue;
    await connection.query(`DELETE FROM process_executions WHERE id = ?`, [
      row.id,
    ]);
    removed += 1;
  }

  return { added, kept, removed };
}

/** Fix pack menus that were already started with old multi-step data */
async function fixStartedPackMenus(connection) {
  const packNames = PACK_JOBS.map((job) => job.jobName);
  if (packNames.length === 0) return 0;

  const [plans] = await connection.query(
    `SELECT id, job_code, job_name
     FROM work_plans
     WHERE bu_id = ? AND job_name IN (?)`,
    [ROGANG_BU_ID, packNames],
  );

  let fixed = 0;
  for (const plan of plans) {
    const packJob = PACK_JOBS.find((job) => job.jobName === plan.job_name);
    if (!packJob) continue;

    await replaceProcessTemplates(
      connection,
      packJob.jobCode,
      PACK_STEPS,
      "แพ็ค",
    );
    await replaceProcessSteps(
      connection,
      packJob.jobCode,
      plan.job_name,
      PACK_STEPS,
    );
    const [batchRows] = await connection.query(
      `SELECT id FROM production_batches WHERE work_plan_id = ? ORDER BY id DESC LIMIT 1`,
      [plan.id],
    );
    await syncProcessExecutions(
      connection,
      plan.id,
      batchRows[0]?.id,
      packJob.jobCode,
      PACK_STEPS,
    );
    fixed += 1;
  }

  return fixed;
}

async function ensureProductionBatch(connection, workPlanId, jobCode) {
  const [existing] = await connection.query(
    `SELECT id, status FROM production_batches WHERE work_plan_id = ? ORDER BY id DESC LIMIT 1`,
    [workPlanId],
  );
  if (existing.length > 0) {
    if (existing[0].status !== "producing") {
      await connection.query(
        `UPDATE production_batches SET status = 'producing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [existing[0].id],
      );
    }
    return existing[0].id;
  }

  const datePart = PRODUCTION_DATE.replace(/-/g, "");
  const [result] = await connection.query(
    `INSERT INTO production_batches (
       work_plan_id, batch_code, product_code, planned_qty, start_time, status, batch_count
     ) VALUES (?, ?, ?, 0, NOW(), 'producing', 1)`,
    [workPlanId, `TT-${workPlanId}-${datePart}`, jobCode],
  );
  return result.insertId;
}

async function assignRogangDefaultOperator(connection) {
  const [plans] = await connection.query(
    `SELECT id FROM work_plans WHERE bu_id = ?`,
    [ROGANG_BU_ID],
  );

  for (const plan of plans) {
    await assignOperator(connection, plan.id, DEFAULT_OPERATOR);
  }

  return plans.length;
}

async function applyRogangSchedule(connection) {
  const [result] = await connection.query(
    `UPDATE work_plans
     SET start_time = ?, end_time = ?, updated_at = CURRENT_TIMESTAMP
     WHERE bu_id = ?`,
    [SCHEDULE_START, SCHEDULE_END, ROGANG_BU_ID],
  );
  return result.affectedRows;
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

    const seededPlans = [];

    for (const job of JOBS) {
      await ensureFgAndProduct(
        connection,
        job.jobCode,
        job.jobName,
        job.outputUnit,
      );
      await replaceProcessTemplates(
        connection,
        job.jobCode,
        job.steps,
        job.stepNote,
      );
      await replaceProcessSteps(
        connection,
        job.jobCode,
        job.jobName,
        job.steps,
      );
      await syncProductNames(connection, job.jobCode, job.jobName);

      const plan = await upsertWorkPlan(connection, job);
      const batchId = await ensureProductionBatch(connection, plan.id, job.jobCode);
      const syncResult = await syncProcessExecutions(
        connection,
        plan.id,
        batchId,
        job.jobCode,
        job.steps,
      );
      await assignOperator(connection, plan.id, DEFAULT_OPERATOR);
      seededPlans.push({
        ...job,
        ...plan,
        productionDate: PRODUCTION_DATE,
        syncResult,
      });
    }

    const fixedPackMenus = await fixStartedPackMenus(connection);

    const rogangPlanCount = await assignRogangDefaultOperator(connection);
    const scheduledCount = await applyRogangSchedule(connection);

    await connection.commit();

    console.log(`Rogang work plans for ${PRODUCTION_DATE}:`);
    for (const plan of seededPlans) {
      console.log(
        `  - ${plan.jobCode}: ${plan.jobName} (id=${plan.id}, ${plan.action})`,
      );
    }
    console.log(`Schedule: ${SCHEDULE_START.slice(0, 5)} - ${SCHEDULE_END.slice(0, 5)} (${scheduledCount} plan(s) updated)`);
    console.log(
      `Default operator "${DEFAULT_OPERATOR.name}" assigned to ${rogangPlanCount} Rogang work plan(s)`,
    );
    if (fixedPackMenus > 0) {
      console.log(
        `Synced ${fixedPackMenus} pack menu(s) to single step "แพ็ค" (timestamps preserved)`,
      );
    }
    console.log("Process step groups:");
    console.log(`  ประกอบอาหาร + แพ็ค: ${COOK_JOBS.length} menu(s)`);
    console.log(`  แพ็ค: ${PACK_JOBS.length} menu(s)`);
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
