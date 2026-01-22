import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando população do ConversationLog...\n');

  // Lê o arquivo data.txt
  const filePath = join(process.cwd(), 'scripts', 'data.txt');
  const fileContent = readFileSync(filePath, 'utf-8');
  
  // Separa as linhas e filtra números válidos
  const lines = fileContent.split('\n').map(line => line.trim());
  const validPhones = new Set<string>();
  
  for (const line of lines) {
    // Ignora linhas vazias e mensagens de erro
    if (line && !line.includes('Número inválido') && /^\d+$/.test(line)) {
      validPhones.add(line);
    }
  }

  console.log(`Encontrados ${validPhones.size} números únicos válidos.\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Cria registros no ConversationLog
  for (const phone of validPhones) {
    try {
      // Verifica se já existe um registro com este telefone
      const existing = await prisma.conversationLog.findUnique({
        where: { phone },
      });

      if (existing) {
        console.log(`⏭️  Telefone ${phone} já existe, pulando...`);
        skipped++;
        continue;
      }

      // Cria novo registro
      await prisma.conversationLog.create({
        data: {
          phone,
          messages: [], // Array vazio de mensagens
          disabled: false,
          conversationStatus: 'ACTIVE',
          stage: null, // ou 'greetings' se preferir
          reactivationAttempts: 0,
        },
      });

      created++;
      if (created % 50 === 0) {
        console.log(`✅ ${created} registros criados...`);
      }
    } catch (error) {
      console.error(`❌ Erro ao criar registro para ${phone}:`, error);
      errors++;
    }
  }

  console.log('\n--- População finalizada! ---');
  console.log(`✅ Registros criados: ${created}`);
  console.log(`⏭️  Registros pulados (já existentes): ${skipped}`);
  console.log(`❌ Erros: ${errors}`);
  console.log(`📊 Total processado: ${validPhones.size}`);
}

main()
  .catch((e) => {
    console.error('Erro na execução:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

