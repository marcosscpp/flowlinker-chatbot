import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Lista todos os vendedores
  const sellers = await prisma.seller.findMany();
  console.log("\nVendedores no banco:");
  sellers.forEach((s) =>
    console.log(`- ${s.name} | ${s.email} | Calendar: ${s.calendarId}`)
  );
}

main().finally(() => prisma.$disconnect());
