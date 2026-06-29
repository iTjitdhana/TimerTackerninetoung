/**
 * วิเคราะห์รูปแบบ users.password (read-only)
 * ใช้: node scripts/inspect-password-hash.cjs
 *      node scripts/inspect-password-hash.cjs --verify 1234 <full-hash>
 *      node scripts/inspect-password-hash.cjs --brute <full-hash>   (PIN 4 หลัก, ใช้กับ test hash เท่านั้น)
 */
const mysql = require("mysql2/promise");
const crypto = require("crypto");
const { loadEnvFile, buildDatabaseUrl } = require("./load-env.cjs");
const { resolve } = require("path");

loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

function detectAlgorithm(hash) {
  if (!hash || typeof hash !== "string") return "unknown";
  if (/^\$2[aby]\$/.test(hash)) return "bcrypt";
  if (/^\$argon2(id|i|d)\$/.test(hash)) return "argon2";
  if (/^[a-f0-9]{32}$/i.test(hash)) return "md5 (hex)";
  if (/^[a-f0-9]{64}$/i.test(hash)) return "sha256 (hex)";
  if (/^[a-f0-9]{40}$/i.test(hash)) return "sha1 (hex)";
  if (/^\{?[A-Z0-9._+-]+\}?$/i.test(hash) && hash.length < 20) return "possible plaintext";
  return "unknown";
}

function md5(text) {
  return crypto.createHash("md5").update(text).digest("hex");
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function tryBcrypt(pin, hash) {
  try {
    const bcrypt = require("bcryptjs");
    return await bcrypt.compare(pin, hash);
  } catch {
    return null;
  }
}

async function bruteForce4Digit(hash, algo) {
  const start = Date.now();
  for (let i = 0; i <= 9999; i++) {
    const pin = String(i).padStart(4, "0");
    let match = false;
    if (algo === "bcrypt") {
      const ok = await tryBcrypt(pin, hash);
      if (ok === true) match = true;
    } else if (algo === "md5 (hex)") {
      match = md5(pin) === hash.toLowerCase();
    } else if (algo === "sha256 (hex)") {
      match = sha256(pin) === hash.toLowerCase();
    } else {
      throw new Error(`brute-force ยังไม่รองรับ algorithm: ${algo}`);
    }
    if (match) {
      return { pin, ms: Date.now() - start, attempts: i + 1 };
    }
  }
  return { pin: null, ms: Date.now() - start, attempts: 10000 };
}

async function fetchSamples(conn) {
  const [rows] = await conn.query(`
    SELECT id, id_code, name,
           LENGTH(password) AS pwd_len,
           LEFT(password, 12) AS pwd_prefix,
           pin_display
    FROM users
    WHERE password IS NOT NULL AND password != ''
    LIMIT 8
  `);
  return rows;
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--sample-verify") {
    const conn = await mysql.createConnection(process.env.DATABASE_URL);
    const [rows] = await conn.query(`
      SELECT id_code, pin_display, password
      FROM users
      WHERE password IS NOT NULL AND password != ''
        AND pin_display IS NOT NULL AND pin_display != ''
      LIMIT 5
    `);
    await conn.end();

    let bcrypt;
    try {
      bcrypt = require("bcryptjs");
    } catch {
      console.log("ติดตั้ง bcryptjs ก่อน: pnpm add bcryptjs");
      process.exit(1);
    }

    console.log("=== ทดสอบ pin_display ตรงกับ bcrypt(password) ไหม ===");
    for (const row of rows) {
      const ok = await bcrypt.compare(row.pin_display, row.password);
      console.log(`${row.id_code}: pin_display=${row.pin_display} → bcrypt match: ${ok}`);
    }
    return;
  }

  if (args[0] === "--verify" && args.length >= 3) {
    const pin = args[1];
    const hash = args[2];
    const algo = detectAlgorithm(hash);
    console.log("Algorithm (detected):", algo);
    if (algo === "bcrypt") {
      const ok = await tryBcrypt(pin, hash);
      console.log(ok === null ? "ติดตั้ง bcryptjs ก่อน: pnpm add bcryptjs" : `bcrypt.compare("${pin}"): ${ok}`);
    } else if (algo === "md5 (hex)") {
      console.log(`md5("${pin}") === hash:`, md5(pin) === hash.toLowerCase());
    } else if (algo === "sha256 (hex)") {
      console.log(`sha256("${pin}") === hash:`, sha256(pin) === hash.toLowerCase());
    } else {
      console.log("ยังไม่รองรับ verify สำหรับ algorithm นี้");
    }
    return;
  }

  if (args[0] === "--brute" && args[1]) {
    const hash = args[1];
    const algo = detectAlgorithm(hash);
    console.log("Algorithm (detected):", algo);
    console.log("กำลังลอง PIN 0000-9999... (ใช้กับ test account เท่านั้น)");
    const result = await bruteForce4Digit(hash, algo);
    if (result.pin) {
      console.log(`พบ PIN ที่ match: ${result.pin} (${result.attempts} attempts, ${result.ms}ms)`);
    } else {
      console.log(`ไม่พบ PIN 4 หลักที่ match (${result.attempts} attempts, ${result.ms}ms)`);
    }
    return;
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const rows = await fetchSamples(conn);
  await conn.end();

  if (rows.length === 0) {
    console.log("ไม่พบ users ที่มี password");
    return;
  }

  console.log("=== ตัวอย่าง users.password (prefix เท่านั้น) ===");
  console.table(rows);

  const [fullRow] = await mysql.createConnection(process.env.DATABASE_URL).then(async (c) => {
    const [r] = await c.query(
      `SELECT password FROM users WHERE password IS NOT NULL AND password != '' LIMIT 1`,
    );
    await c.end();
    return r;
  });

  if (fullRow[0]?.password) {
    const hash = fullRow[0].password;
    const algo = detectAlgorithm(hash);
    console.log("\n=== วิเคราะห์ hash แถวแรก ===");
    console.log("Length:", hash.length);
    console.log("Prefix:", hash.slice(0, 12) + "...");
    console.log("Algorithm (guessed):", algo);
    console.log("\nถ้ารู้ PIN ของ user นี้ ทดสอบ:");
    console.log(`  node scripts/inspect-password-hash.cjs --verify YOUR_PIN "${hash}"`);
    console.log("\nถ้าเป็น test account เท่านั้น ลอง brute 4 หลัก:");
    console.log(`  node scripts/inspect-password-hash.cjs --brute "${hash}"`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
