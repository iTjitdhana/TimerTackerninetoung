/**
 * Manual smoke test for onhand Cost Price API.
 * Usage: node scripts/test-onhand-cost-price.mjs [RM105001 RM201010 ...]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env optional for manual test when vars are exported in shell
  }
}

loadEnv();

const apiUrl = process.env.ONHAND_COST_PRICE_API_URL?.trim();
const token = process.env.ONHAND_COST_PRICE_API_TOKEN?.trim();
const productCodes = process.argv.slice(2);

if (!apiUrl || !token) {
  console.error(
    "Set ONHAND_COST_PRICE_API_URL and ONHAND_COST_PRICE_API_TOKEN in backend/.env",
  );
  process.exit(1);
}

if (productCodes.length === 0) {
  productCodes.push("RM105001", "RM201010", "RM301020");
}

const response = await fetch(apiUrl, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json; charset=utf-8",
  },
  body: JSON.stringify({ product_codes: productCodes }),
});

const text = await response.text();
console.log(`HTTP ${response.status}`);
try {
  const data = JSON.parse(text);
  console.log(JSON.stringify(data, null, 2));
  if (!response.ok || data.success === false) {
    process.exit(1);
  }
} catch {
  console.log(text);
  process.exit(1);
}
