import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...\n');

  // Limpa dados existentes
  await prisma.meeting.deleteMany();
  await prisma.seller.deleteMany();

  // Cria vendedores de exemplo
  // IMPORTANTE: Substitua os calendarIds pelos calendarios reais dos vendedores
  const sellers = await prisma.seller.createMany({
    data: [
      {
        name: 'Vendedor A',
        email: 'vendedor.a@empresa.com',
        phone: '5511999990001',
        calendarId: 'vendedor.a@gmail.com', // Substituir pelo calendario real
        isActive: true,
      },
      {
        name: 'Vendedor B',
        email: 'vendedor.b@empresa.com',
        phone: '5511999990002',
        calendarId: 'vendedor.b@gmail.com', // Substituir pelo calendario real
        isActive: true,
      },
      {
        name: 'Vendedor C',
        email: 'vendedor.c@empresa.com',
        phone: '5511999990003',
        calendarId: 'vendedor.c@gmail.com', // Substituir pelo calendario real
        isActive: true,
      },
    ],
  });

  console.log(`Criados ${sellers.count} vendedores de exemplo.`);

  const allSellers = await prisma.seller.findMany();
  console.log('\nVendedores cadastrados:');
  allSellers.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name} (${s.email}) - Calendar: ${s.calendarId}`);
  });

  console.log('\n--- Seed finalizado! ---');
  console.log('\nLembre-se de:');
  console.log('1. Atualizar os calendarIds com os calendarios reais');
  console.log('2. Compartilhar cada calendario com a Service Account');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
