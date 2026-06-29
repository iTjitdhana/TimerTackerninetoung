import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import { loadEnvFile, buildDatabaseUrl } from "./load-env.cjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

const API = "http://127.0.0.1:3001/api";
const PATCH_JOB_ID = "11206";
const START_JOB_ID = "597";

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function clockHms(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
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
    const [users] = await connection.query(
      "SELECT name FROM users WHERE is_active = 1 LIMIT 1",
    );
    assert(users.length > 0, "No active user in DB");
    const userName = users[0].name;

    const auth = await api("/auth/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "1234" }),
    });
    assert(auth.status === 200 || auth.status === 201, "Auth failed");
    const headers = {
      Authorization: `Bearer ${auth.body.token}`,
      "Content-Type": "application/json",
    };

    console.log("Fix 1: PATCH timestamps on existing session", PATCH_JOB_ID);
    await connection.query(
      "UPDATE process_executions SET start_time = NULL, end_time = NULL, status = 'pending' WHERE work_plan_id = ?",
      [PATCH_JOB_ID],
    );

    const getPatchJob = await api(`/production-timer/${PATCH_JOB_ID}`, { headers });
    assert(getPatchJob.status === 200, `GET ${PATCH_JOB_ID} failed`);
    assert(getPatchJob.body.steps?.length > 0, `No steps for ${PATCH_JOB_ID}`);

    const stepName = getPatchJob.body.steps[0].stepName;
    const startTime = clockHms();
    const patchStart = await api(`/production-timer/${PATCH_JOB_ID}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        steps: [{ stepName, startTime, completed: false }],
      }),
    });
    assert(patchStart.status === 200, `PATCH start failed: ${JSON.stringify(patchStart.body)}`);

    await new Promise((r) => setTimeout(r, 1200));
    const endTime = clockHms();
    const patchEnd = await api(`/production-timer/${PATCH_JOB_ID}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        steps: [
          {
            stepName,
            startTime,
            endTime,
            duration: "00:01",
            completed: true,
          },
        ],
      }),
    });
    assert(patchEnd.status === 200, `PATCH end failed: ${JSON.stringify(patchEnd.body)}`);

    const [patchRows] = await connection.query(
      "SELECT start_time, end_time, duration_minutes, status FROM process_executions WHERE work_plan_id = ?",
      [PATCH_JOB_ID],
    );
    assert(patchRows[0]?.start_time, "start_time not saved (Fix 1)");
    assert(patchRows[0]?.end_time, "end_time not saved (Fix 1)");
    assert(
      patchRows[0]?.status === "completed",
      `expected completed status, got ${patchRows[0]?.status}`,
    );

    await connection.query(
      "UPDATE process_executions SET start_time = NULL, end_time = NULL, status = 'pending' WHERE work_plan_id = ?",
      [PATCH_JOB_ID],
    );
    console.log("Fix 1 PASSED (reverted test data)");

    console.log("Fix 2: POST start + PATCH on", START_JOB_ID);
    await connection.query(
      "DELETE FROM process_executions WHERE work_plan_id = ?",
      [START_JOB_ID],
    );

    const postStart = await api("/production-timer", {
      method: "POST",
      headers,
      body: JSON.stringify({ jobId: START_JOB_ID, startedBy: userName }),
    });
    assert(
      postStart.status === 200 || postStart.status === 201,
      `POST start failed: ${JSON.stringify(postStart.body)}`,
    );
    assert(postStart.body.steps?.length > 0, "No steps after POST start");

    const [execRows] = await connection.query(
      "SELECT template_id FROM process_executions WHERE work_plan_id = ? ORDER BY process_number LIMIT 1",
      [START_JOB_ID],
    );
    assert(execRows.length > 0, "process_executions not created (Fix 2)");
    assert(
      execRows[0].template_id < 90000,
      `template_id looks external: ${execRows[0].template_id}`,
    );

    const startStep = postStart.body.steps[0];
    const start2 = clockHms();
    const patchStart2 = await api(`/production-timer/${START_JOB_ID}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        steps: postStart.body.steps.map((step, index) =>
          index === 0
            ? { stepName: step.stepName, startTime: start2, completed: false }
            : step,
        ),
      }),
    });
    assert(patchStart2.status === 200, `PATCH start2 failed: ${JSON.stringify(patchStart2.body)}`);

    await new Promise((r) => setTimeout(r, 1200));
    const end2 = clockHms();
    const patchEnd2 = await api(`/production-timer/${START_JOB_ID}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        steps: patchStart2.body.steps.map((step, index) =>
          index === 0
            ? {
                stepName: step.stepName,
                startTime: start2,
                endTime: end2,
                duration: "00:01",
                completed: true,
              }
            : step,
        ),
      }),
    });
    assert(patchEnd2.status === 200, `PATCH end2 failed: ${JSON.stringify(patchEnd2.body)}`);

    const [startJobRow] = await connection.query(
      "SELECT start_time, end_time, status FROM process_executions WHERE work_plan_id = ? AND process_number = 1",
      [START_JOB_ID],
    );
    assert(startJobRow[0]?.start_time, "start_time not saved (Fix 2)");
    assert(startJobRow[0]?.end_time, "end_time not saved (Fix 2)");

    await connection.query(
      "DELETE FROM process_executions WHERE work_plan_id = ?",
      [START_JOB_ID],
    );
    console.log("Fix 2 PASSED (cleaned test executions)");

    console.log("Verification PASSED");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Verification FAILED:", error.message);
  process.exit(1);
});
