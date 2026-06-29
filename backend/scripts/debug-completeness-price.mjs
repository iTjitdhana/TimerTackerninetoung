import { PrismaClient } from "@prisma/client";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
require("./load-env.cjs");

const prisma = new PrismaClient();
const jobCode = process.argv[2] ?? "230001";
const date = process.argv[3] ?? "2026-06-17";

try {
  const wps = await prisma.work_plans.findMany({
    where: { job_code: jobCode },
    select: {
      id: true,
      job_code: true,
      job_name: true,
      production_date: true,
    },
    orderBy: { production_date: "desc" },
  });

  console.log("all work_plans for job_code:", JSON.stringify(wps, null, 2));

  const wp = wps.find((row) => {
    const iso = row.production_date.toISOString().slice(0, 10);
    return iso === date;
  });

  if (!wp) {
    console.log(`no work plan for ${jobCode} on ${date}`);
    process.exit(0);
  }

  const batches = await prisma.production_batches.findMany({
    where: { work_plan_id: wp.id },
    orderBy: { id: "asc" },
    select: { id: true, work_plan_id: true, batch_count: true },
  });

  console.log("batches:", batches);

  for (const batch of batches) {
    const usage = await prisma.batch_material_usage.findMany({
      where: { batch_id: batch.id },
      select: {
        id: true,
        material_id: true,
        actual_qty: true,
        unit_price: true,
        total_cost: true,
        price_source: true,
      },
    });
    const zeroPrice = usage.filter((row) => Number(row.unit_price) <= 0);
    console.log(
      `batch ${batch.id}: ${usage.length} usage rows, ${zeroPrice.length} with unit_price <= 0`,
    );
    if (usage.length > 0) {
      console.log("first rows:", usage.slice(0, 5));
    }
    if (zeroPrice.length > 0) {
      console.log("zero price rows:", zeroPrice.slice(0, 5));
    }
  }

  const usageViaJoin = await prisma.batch_material_usage.findMany({
    where: { production_batches: { work_plan_id: wp.id } },
    select: {
      batch_id: true,
      unit_price: true,
      actual_qty: true,
      materials: { select: { material_code: true, material_name: true } },
    },
  });
  console.log("usage via work_plan join:", usageViaJoin.length, usageViaJoin.slice(0, 5));

  const costs = await prisma.production_costs.findMany({
    where: { work_plan_id: BigInt(wp.id) },
    select: {
      id: true,
      material_cost: true,
      input_material_qty: true,
      total_cost: true,
      production_date: true,
    },
  });
  console.log("production_costs:", costs);
} finally {
  await prisma.$disconnect();
}
