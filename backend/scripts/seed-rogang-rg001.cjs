const { resolve } = require("path");
const mysql = require("mysql2/promise");
const { loadEnvFile, buildDatabaseUrl } = require("./load-env.cjs");

loadEnvFile(resolve(__dirname, "../.env"));
buildDatabaseUrl();

const FG_CODE = "RG001";
const FG_NAME = "กุ้งผัดผงกระหรี่ + หมูปั้น + ข้าวสวย";
const ROGANG_BU_ID = 2;
const TEST_NOTE = "ทดสอบระบบ";
const PRODUCTION_DATE = "2026-05-27";

/** น้ำหนักไข่เป็ดต่อ 1 ฟอง (กก.) — ปรับค่านี้ได้ */
const DUCK_EGG_WEIGHT_KG = 0.07;
/** น้ำหนักซอสผัดผงกระหรี่ต่อ 1 แพ็ค (กก.) */
const CURRY_SAUCE_PACK_WEIGHT_KG = 0.142;
/** น้ำหนักหมูปั้นก้อนต่อ 1 ชิ้น (กก.) */
const PORK_BALL_WEIGHT_KG = 0.04;
/** ขนาดมาตรฐานผลิตภัณฑ์ต่อ 1 กล่อง */
const FG_BOX_WEIGHT_G = 420;
const FG_BOX_WEIGHT_KG = FG_BOX_WEIGHT_G / 1000;

const INGREDIENTS = [
  { name: "ไข่เป็ด", qty: 54, unit: "ฟอง", fallbackCode: "RG101" },
  { name: "ต้นหอม", qty: 200, unit: "กรัม", fallbackCode: "RG103" },
  { name: "พริกชี้ฟ้าแดง", qty: 80, unit: "กรัม", fallbackCode: "RG104" },
  { name: "กุ้ง", qty: 1, unit: "กก.", fallbackCode: "RG106" },
  {
    name: "ซอสผัดผงกระหรี่ 142 กรัม",
    qty: 18,
    unit: "แพ็ค",
    fallbackCode: "RG107",
  },
  {
    name: "หมูปั้นก้อนนึ่ง 20 ชิ้น",
    qty: 36,
    unit: "ชิ้น",
    fallbackCode: "RG105",
  },
  {
    name: "ข้าวสวย(หุงแล้ว) 200 กรัม",
    qty: 7.2,
    unit: "กก.",
    fallbackCode: "RG108",
  },
];

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseProductionDate() {
  const [year, month, day] = PRODUCTION_DATE.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

async function findMaterialByName(connection, name) {
  const [rows] = await connection.query(
    `SELECT Mat_Id, Mat_Name, Mat_Unit
     FROM material
     WHERE TRIM(Mat_Name) = ?
     ORDER BY id ASC
     LIMIT 1`,
    [name.trim()],
  );
  return rows[0] ?? null;
}

async function ensureMaterial(connection, ingredient) {
  const existing = await findMaterialByName(connection, ingredient.name);
  if (existing) {
    return {
      code: existing.Mat_Id,
      name: existing.Mat_Name,
      unit: existing.Mat_Unit,
      source: "reuse",
    };
  }

  const code = ingredient.fallbackCode;

  await connection.query(
    `INSERT INTO material (Mat_Id, Mat_Name, Mat_Unit, price)
     VALUES (?, ?, ?, 0.00)
     ON DUPLICATE KEY UPDATE
       Mat_Name = VALUES(Mat_Name),
       Mat_Unit = VALUES(Mat_Unit)`,
    [code, ingredient.name, ingredient.unit],
  );

  await connection.query(
    `INSERT INTO materials (material_code, material_name, unit, price)
     VALUES (?, ?, ?, 0.00)
     ON DUPLICATE KEY UPDATE
       material_name = VALUES(material_name),
       unit = VALUES(unit)`,
    [code, ingredient.name, ingredient.unit],
  );

  return {
    code,
    name: ingredient.name,
    unit: ingredient.unit,
    source: "created",
  };
}

async function upsertFg(connection) {
  await connection.query(
    `INSERT INTO fg (
       FG_Code, FG_Name, FG_Unit, FG_Size, base_unit, conversion_rate, conversion_description
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       FG_Name = VALUES(FG_Name),
       FG_Unit = VALUES(FG_Unit),
       FG_Size = VALUES(FG_Size),
       base_unit = VALUES(base_unit),
       conversion_rate = VALUES(conversion_rate),
       conversion_description = VALUES(conversion_description),
       updated_at = CURRENT_TIMESTAMP`,
    [
      FG_CODE,
      FG_NAME,
      "กล่อง",
      `${FG_BOX_WEIGHT_G} กรัม/กล่อง`,
      "กก.",
      FG_BOX_WEIGHT_KG,
      `1 กล่อง = ${FG_BOX_WEIGHT_KG} กก. (${FG_BOX_WEIGHT_G} กรัม)`,
    ],
  );
}

async function replaceFgBom(connection, resolvedIngredients) {
  await connection.query(`DELETE FROM fg_bom WHERE FG_Code = ?`, [FG_CODE]);

  for (const item of resolvedIngredients) {
    await connection.query(
      `INSERT INTO fg_bom (FG_Code, Raw_Code, Raw_Qty, Raw_Unit)
       VALUES (?, ?, ?, ?)`,
      [FG_CODE, item.code, item.qty, item.unit],
    );
  }
}

async function upsertProduct(connection) {
  await connection.query(
    `INSERT INTO products (
       product_code, product_name, product_type, unit, is_active
     ) VALUES (?, ?, 'FG', ?, 1)
     ON DUPLICATE KEY UPDATE
       product_name = VALUES(product_name),
       product_type = VALUES(product_type),
       unit = VALUES(unit),
       is_active = VALUES(is_active),
       updated_at = CURRENT_TIMESTAMP`,
    [FG_CODE, FG_NAME.slice(0, 100), "กล่อง"],
  );
}

async function upsertUnitConversions(connection, resolvedIngredients) {
  const conversions = [
    {
      materialName: "ไข่เป็ด",
      fromUnit: "ฟอง",
      rateKg: DUCK_EGG_WEIGHT_KG,
    },
    {
      materialName: "ซอสผัดผงกระหรี่ 142 กรัม",
      fromUnit: "แพ็ค",
      rateKg: CURRY_SAUCE_PACK_WEIGHT_KG,
    },
    {
      materialName: "หมูปั้นก้อนนึ่ง 20 ชิ้น",
      fromUnit: "ชิ้น",
      rateKg: PORK_BALL_WEIGHT_KG,
    },
  ];

  for (const conversion of conversions) {
    const material = resolvedIngredients.find(
      (item) => item.name === conversion.materialName,
    );
    if (!material) continue;

    const weightGram = conversion.rateKg * 1000;
    await connection.query(
      `INSERT INTO unit_conversions (
         from_unit, to_unit, conversion_rate, description, material_name, material_code
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         conversion_rate = VALUES(conversion_rate),
         description = VALUES(description),
         material_name = VALUES(material_name),
         updated_at = CURRENT_TIMESTAMP`,
      [
        conversion.fromUnit,
        "กก.",
        conversion.rateKg,
        `1 ${conversion.fromUnit} = ${conversion.rateKg} กก. (${weightGram} กรัม)`,
        conversion.materialName,
        material.code,
      ],
    );
  }
}

async function cleanupRemovedBomUsage(connection, activeCodes) {
  const codeList = [...activeCodes];
  if (codeList.length === 0) return;

  const [batches] = await connection.query(
    `SELECT pb.id
     FROM production_batches pb
     INNER JOIN work_plans wp ON wp.id = pb.work_plan_id
     WHERE wp.job_code = ? AND wp.bu_id = ?`,
    [FG_CODE, ROGANG_BU_ID],
  );

  for (const batch of batches) {
    await connection.query(
      `DELETE bmu
       FROM batch_material_usage bmu
       INNER JOIN materials m ON m.id = bmu.material_id
       WHERE bmu.batch_id = ?
         AND m.material_code NOT IN (?)`,
      [batch.id, codeList],
    );
  }
}

async function syncWorkPlanNames(connection) {
  await connection.query(
    `UPDATE work_plans
     SET job_name = ?, updated_at = CURRENT_TIMESTAMP
     WHERE job_code = ? AND bu_id = ?`,
    [FG_NAME, FG_CODE, ROGANG_BU_ID],
  );
}

async function syncProcessStepNames(connection) {
  await connection.query(
    `UPDATE process_steps
     SET job_name = ?, updated_at = CURRENT_TIMESTAMP
     WHERE job_code = ?`,
    [FG_NAME, FG_CODE],
  );
}

async function findWorkPlan(connection, productionDate) {
  const [rows] = await connection.query(
    `SELECT id, production_date, job_code, bu_id
     FROM work_plans
     WHERE production_date = ?
       AND job_code = ?
       AND bu_id = ?
     LIMIT 1`,
    [formatDate(productionDate), FG_CODE, ROGANG_BU_ID],
  );
  return rows[0] ?? null;
}

async function upsertWorkPlan(connection, productionDate) {
  const existing = await findWorkPlan(connection, productionDate);
  if (existing) {
    await connection.query(
      `UPDATE work_plans
       SET job_name = ?, bu_id = ?, notes = ?, workflow_status = 'draft', status_id = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [FG_NAME, ROGANG_BU_ID, TEST_NOTE, existing.id],
    );
    return { id: existing.id, productionDate: formatDate(productionDate), action: "updated" };
  }

  const [result] = await connection.query(
    `INSERT INTO work_plans (
       production_date, job_code, job_name, job_type, status_id, workflow_status, bu_id, notes
     ) VALUES (?, ?, ?, 'regular', 1, 'draft', ?, ?)`,
    [formatDate(productionDate), FG_CODE, FG_NAME, ROGANG_BU_ID, TEST_NOTE],
  );

  return {
    id: result.insertId,
    productionDate: formatDate(productionDate),
    action: "created",
  };
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

    const resolvedIngredients = [];
    for (const ingredient of INGREDIENTS) {
      const resolved = await ensureMaterial(connection, ingredient);
      resolvedIngredients.push({
        ...resolved,
        qty: ingredient.qty,
        unit: ingredient.unit,
      });
    }

    await upsertFg(connection);
    await replaceFgBom(connection, resolvedIngredients);
    await cleanupRemovedBomUsage(
      connection,
      resolvedIngredients.map((item) => item.code),
    );
    await upsertUnitConversions(connection, resolvedIngredients);
    await upsertProduct(connection);
    await syncWorkPlanNames(connection);
    await syncProcessStepNames(connection);

    const productionDate = parseProductionDate();
    const workPlans = [await upsertWorkPlan(connection, productionDate)];

    await connection.commit();

    console.log(`Seeded ROGANG menu ${FG_CODE}: ${FG_NAME}`);
    console.log(`Duck egg weight: ${DUCK_EGG_WEIGHT_KG} kg/ฟอง (${DUCK_EGG_WEIGHT_KG * 1000} g)`);
    console.log("Materials:");
    for (const item of resolvedIngredients) {
      console.log(
        `  - ${item.code} (${item.source}): ${item.name} ${item.qty} ${item.unit}`,
      );
    }
    console.log("Work plans:");
    for (const plan of workPlans) {
      console.log(`  - id=${plan.id} date=${plan.productionDate} (${plan.action})`);
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
