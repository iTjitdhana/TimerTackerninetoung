import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const name = "น้ำแกงส้ม 450 กรัม   (1*5 แพ็ค)";

try {
  const tests = [
    name.slice(0, 40),
    name.slice(0, 20),
    "น้ำแกงส้ม 450 กรัม",
    "น้ำแกงส้ม",
    "135012",
  ];
  for (const q of tests) {
    const r = await prisma.fg.findFirst({
      where: { FG_Name: { contains: q } },
    });
    console.log("contains", JSON.stringify(q), "->", r?.FG_Code, r?.FG_Unit);
  }

  const byCode = await prisma.fg.findFirst({
    where: { FG_Name: { contains: "135012" } },
  });
  console.log("by 135012 in name", byCode?.FG_Code);
} finally {
  await prisma.$disconnect();
}
