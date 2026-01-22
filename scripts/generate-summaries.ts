/**
 * Script OTIMIZADO para gerar resumos com concorrência
 * Uso: npx tsx scripts/generate-summaries.ts --concurrency=10
 */

import "dotenv/config";
import pLimit from "p-limit"; // Importe o p-limit
import { prisma } from "../src/database/client.js";
import {
  generateOrGetSummary,
  findConversationsWithoutSummary,
} from "../src/services/summary-generator.js";

interface ScriptOptions {
  limit: number;
  concurrency: number; // Nova opção
  all: boolean;
}

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {
    limit: 50,
    concurrency: 5, // Padrão conservador
    all: false,
  };

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      options.limit = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--concurrency=")) {
      options.concurrency = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--all") {
      options.all = true;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log("=".repeat(60));
  console.log("  GERADOR DE RESUMOS (OTIMIZADO)");
  console.log("=".repeat(60));
  console.log(`  - Concorrência: ${options.concurrency} threads simultâneas`);
  console.log(`  - Modo: ${options.all ? "Processar TUDO" : `Limite de ${options.limit}`}`);
  console.log();

  // 1. Contagem inicial
  const totalWithoutSummary = await prisma.conversationLog.count({
    where: { summary: null },
  });

  console.log(`Conversas pendentes: ${totalWithoutSummary}`);
  if (totalWithoutSummary === 0) return;

  // 2. Setup do controle de fluxo
  let processed = 0;
  let success = 0;
  let failed = 0;
  
  // O limitador define quantas Promises rodam ao mesmo tempo
  const limit = pLimit(options.concurrency);
  
  // Se for --all, pegamos um lote grande para alimentar a fila, 
  // caso contrário pegamos apenas o limite solicitado.
  const fetchSize = options.all ? 1000 : options.limit;

  while (true) {
    // Busca as conversas no banco
    const conversations = await findConversationsWithoutSummary(fetchSize);
    
    if (conversations.length === 0) break;

    // Cria um array de Promises controladas pelo p-limit
    const tasks = conversations.map((conv) => {
      return limit(async () => {
        // Verifica se já passamos do limite global (caso não seja --all)
        if (!options.all && processed >= options.limit) return;

        try {
          const result = await generateOrGetSummary(conv.id);
          processed++;
          
          if (result) {
            success++;
            // Log simplificado para não quebrar a linha com muitas threads
            process.stdout.write(`V`); 
          } else {
            failed++;
            process.stdout.write(`X`);
          }
        } catch (error) {
          failed++;
          processed++;
          process.stdout.write(`E`);
        }
      });
    });

    // Aguarda todas as tarefas deste lote terminarem
    await Promise.all(tasks);

    // Logs de progresso do lote
    console.log(`\n--- Progresso: ${processed} processados (Sucesso: ${success} | Falhas: ${failed}) ---`);

    // Critério de parada
    if (!options.all && processed >= options.limit) break;
    
    // Se for --all e ainda tem itens, o loop continua e busca mais 1000
    if (options.all && processed >= totalWithoutSummary) break;
  }

  console.log("\n\n" + "=".repeat(60));
  console.log("  RESULTADO FINAL");
  console.log(`  Processados: ${processed}`);
  console.log(`  Sucesso: ${success}`);
  console.log(`  Falhas: ${failed}`);
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

main().catch(console.error);