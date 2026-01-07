import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Atualiza o Vendedor A com os dados reais
  const seller = await prisma.seller.create({
    data: {
      name: "Marcos",
      email: "marcosmodtecnologia@gmail.com",
      calendarId:
        "d556390375b499e0de707e920f829a784053f5d9abb444c87abb33bb6614ba34@group.calendar.google.com",
    },
  });

  const sellers = await prisma.seller.findMany();
  console.log("\nVendedores no banco:");
  sellers.forEach((s) =>
    console.log(`- ${s.name} | ${s.email} | Calendar: ${s.calendarId}`)
  );
}

main().finally(() => prisma.$disconnect());
