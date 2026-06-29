/**
 * ทดสอบ login bcrypt กับ DB จริง
 * ใช้: node scripts/test-bcrypt-login.cjs
 */
const mysql = require("mysql2/promise");
const { loadEnvFile, buildDatabaseUrl } = require("./load-env.cjs");
const { resolve } = require("path");

loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

const API = process.env.API_URL ?? "http://127.0.0.1:3001/api";

async function verifyPin(pin) {
  const res = await fetch(`${API}/auth/verify-pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  const body = await res.text();
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    json = body;
  }
  return { status: res.status, body: json };
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const cases = [
    { label: "man (sync)", pin: "1431", id_code: "man" },
    { label: "noi (stale pin_display)", pin: "1432", id_code: "noi" },
    { label: "invalid", pin: "0000", id_code: null },
  ];

  console.log("=== DB pin_display check ===");
  for (const c of cases.filter((x) => x.id_code)) {
    const [rows] = await conn.query(
      "SELECT id_code, pin_display FROM users WHERE id_code = ? LIMIT 1",
      [c.id_code],
    );
    console.log(`${c.id_code}: pin_display=${rows[0]?.pin_display ?? "—"}`);
  }
  await conn.end();

  console.log("\n=== API verify-pin ===");
  for (const c of cases) {
    const result = await verifyPin(c.pin);
    const name = result.body?.user?.name ?? result.body?.message ?? result.body;
    console.log(`${c.label} pin=${c.pin} → HTTP ${result.status} ${typeof name === "string" ? name : JSON.stringify(name)}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
