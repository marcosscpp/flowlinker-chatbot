import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Cria a vendedora Maria (João já foi criado)
  const maria = await prisma.seller.create({
    data: {
      name: "Maria",
      email: "maria@flowlinker.com",
      calendarId:
        "c_632ac1e00e748b86f58c395f53db2881da6e0cdd0ae4c91b565fbfcc8a1d22da@group.calendar.google.com",
    },
  });
  console.log("Vendedor criado:", maria.name);

  const sellers = await prisma.seller.findMany();
  console.log("\nVendedores no banco:");
  sellers.forEach((s) =>
    console.log(`- ${s.name} | ${s.email} | Calendar: ${s.calendarId}`)
  );
}

main().finally(() => prisma.$disconnect());
