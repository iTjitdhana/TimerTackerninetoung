const mysql = require("mysql2/promise");
(async () => {
  const c = await mysql.createConnection({
    host: "192.168.0.96",
    user: "jitdhana",
    password: "iT12345$",
    database: "MNF_database411",
    port: 3306,
  });
  try {
    await c.query(
      "ALTER TABLE batch_material_usage ADD COLUMN price_source VARCHAR(10) NULL AFTER note",
    );
    console.log("column added");
  } catch (e) {
    if (e.code === "ER_DUP_FIELDNAME") console.log("column already exists");
    else throw e;
  }
  const [cols] = await c.query(
    "SHOW COLUMNS FROM batch_material_usage LIKE ?",
    ["price_source"],
  );
  console.log(cols);
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
