const { readFileSync, existsSync } = require("fs");
const { resolve } = require("path");
const { execSync } = require("child_process");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
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

    process.env[key] = value;
  }
}

function buildMysqlUrl(host, user, password, dbName, port) {
  const encodedUser = encodeURIComponent(user);
  const encodedPassword =
    password !== undefined && password !== ""
      ? encodeURIComponent(password)
      : "";
  const auth = encodedPassword ? `${encodedUser}:${encodedPassword}` : encodedUser;
  return `mysql://${auth}@${host}:${port}/${dbName}?connectionTimeZone=Z`;
}

function buildDatabaseUrl() {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) return;

  const port = DB_PORT || "3306";
  process.env.DATABASE_URL = buildMysqlUrl(
    DB_HOST,
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
    port,
  );

  const stepsDbName = process.env.STEPS_DB_NAME;
  if (!stepsDbName) return;

  process.env.STEPS_DATABASE_URL = buildMysqlUrl(
    process.env.STEPS_DB_HOST || DB_HOST,
    process.env.STEPS_DB_USER || DB_USER,
    process.env.STEPS_DB_PASSWORD ?? DB_PASSWORD,
    stepsDbName,
    process.env.STEPS_DB_PORT || port,
  );

  const templatesDbName = process.env.TEMPLATES_DB_NAME;
  if (!templatesDbName) return;

  process.env.TEMPLATES_DATABASE_URL = buildMysqlUrl(
    process.env.TEMPLATES_DB_HOST || DB_HOST,
    process.env.TEMPLATES_DB_USER || DB_USER,
    process.env.TEMPLATES_DB_PASSWORD ?? DB_PASSWORD,
    templatesDbName,
    process.env.TEMPLATES_DB_PORT || port,
  );
}

loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

if (require.main === module) {
  const command = process.argv.slice(2).join(" ");
  if (!command) process.exit(0);
  execSync(command, { stdio: "inherit", env: process.env, shell: true });
}

module.exports = { loadEnvFile, buildDatabaseUrl };
