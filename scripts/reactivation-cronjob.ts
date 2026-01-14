/**
 * Script de Reativação de Contatos
 *
 * Este script é chamado pelo cronjob do Render para:
 * 1. Analisar contatos inativos
 * 2. Enviar mensagens de reativação com delays seguros
 *
 * Configuração via variáveis de ambiente ou argumentos CLI:
 * - REACTIVATION_INACTIVE_DAYS: Dias sem contato (padrão: 2)
 * - REACTIVATION_MAX_ATTEMPTS: Máximo de tentativas (padrão: 3)
 * - REACTIVATION_DAILY_LIMIT: Limite diário de mensagens (padrão: 50)
 * - REACTIVATION_DELAY_MS: Delay entre mensagens em ms (padrão: 45000)
 *
 * Uso:
 *   npx tsx scripts/reactivation-cronjob.ts [--analyze-only] [--send-only]
 *
 * Opções:
 *   --analyze-only: Apenas analisa e enfileira, não envia
 *   --send-only: Apenas processa a fila de envio
 *   (sem opção): Executa ciclo completo (envio + análise)
 */

import "dotenv/config";
import {
  runReactivationCycle,
  analyzeAndQueueContacts,
  processReactivationQueue,
  getReactivationStats,
  type ReactivationConfig,
} from "../src/services/reactivation.js";
import { getDefaultInstance } from "../src/config/instances.js";

// Configuração via environment ou padrões seguros
const config: ReactivationConfig = {
  inactiveDays: parseInt(process.env.REACTIVATION_INACTIVE_DAYS || "2", 10),
  maxAttempts: parseInt(process.env.REACTIVATION_MAX_ATTEMPTS || "3", 10),
  dailyLimit: parseInt(process.env.REACTIVATION_DAILY_LIMIT || "50", 10),
  delayBetweenMessages: parseInt(process.env.REACTIVATION_DELAY_MS || "45000", 10),
  instance: process.env.REACTIVATION_INSTANCE || getDefaultInstance(),
};

async function main() {
  console.log("=".repeat(60));
  console.log("REATIVAÇÃO DE CONTATOS - CRONJOB");
  console.log(`Executado em: ${new Date().toISOString()}`);
  console.log("=".repeat(60));
  console.log("\nConfiguração:");
  console.log(`  - Dias de inatividade: ${config.inactiveDays}`);
  console.log(`  - Máximo de tentativas: ${config.maxAttempts}`);
  console.log(`  - Limite diário: ${config.dailyLimit} mensagens`);
  console.log(`  - Delay entre mensagens: ${config.delayBetweenMessages}ms`);
  console.log(`  - Instância: ${config.instance}`);
  console.log("");

  const args = process.argv.slice(2);
  const analyzeOnly = args.includes("--analyze-only");
  const sendOnly = args.includes("--send-only");

  try {
    // Mostra estatísticas antes
    console.log("📊 Estatísticas antes da execução:");
    const statsBefore = await getReactivationStats();
    console.log(`  - Fila pendente: ${statsBefore.pendingQueue}`);
    console.log(`  - Enviadas hoje: ${statsBefore.sentToday}`);
    console.log(`  - Falhas hoje: ${statsBefore.failedToday}`);
    console.log(`  - Contatos em reativação: ${statsBefore.contactsReactivated}`);
    console.log(`  - Contatos descartados: ${statsBefore.contactsDiscarded}`);
    console.log("");

    if (analyzeOnly) {
      // Apenas analisa e enfileira
      console.log("🔍 Modo: APENAS ANÁLISE");
      const result = await analyzeAndQueueContacts(config);

      console.log("\n📋 Resultado da análise:");
      console.log(`  - Total analisado: ${result.totalAnalyzed}`);
      console.log(`  - Enfileirados: ${result.queued}`);
      console.log(`  - Descartados: ${result.discarded}`);
      console.log(`  - Pulados: ${result.skipped}`);
      console.log(`  - Erros: ${result.errors}`);

      if (result.details.length > 0) {
        console.log("\nDetalhes:");
        result.details.forEach((d) => {
          console.log(`  [${d.action.toUpperCase()}] ${d.phone}: ${d.reason}`);
        });
      }
    } else if (sendOnly) {
      // Apenas processa fila de envio
      console.log("📤 Modo: APENAS ENVIO");
      const result = await processReactivationQueue(config);

      console.log("\n📋 Resultado do envio:");
      console.log(`  - Enviadas: ${result.sent}`);
      console.log(`  - Falhas: ${result.failed}`);
      console.log(`  - Restantes na fila: ${result.remaining}`);

      if (result.details.length > 0) {
        console.log("\nDetalhes:");
        result.details.forEach((d) => {
          if (d.status === "sent") {
            console.log(`  [ENVIADO] ${d.phone}`);
          } else {
            console.log(`  [FALHOU] ${d.phone}: ${d.error}`);
          }
        });
      }
    } else {
      // Ciclo completo
      console.log("🔄 Modo: CICLO COMPLETO (envio + análise)");
      const { analysis, sending } = await runReactivationCycle(config);

      console.log("\n📤 Resultado do envio:");
      console.log(`  - Enviadas: ${sending.sent}`);
      console.log(`  - Falhas: ${sending.failed}`);
      console.log(`  - Restantes: ${sending.remaining}`);

      console.log("\n🔍 Resultado da análise:");
      console.log(`  - Total analisado: ${analysis.totalAnalyzed}`);
      console.log(`  - Enfileirados: ${analysis.queued}`);
      console.log(`  - Descartados: ${analysis.discarded}`);
      console.log(`  - Pulados: ${analysis.skipped}`);
      console.log(`  - Erros: ${analysis.errors}`);
    }

    // Mostra estatísticas depois
    console.log("\n📊 Estatísticas após a execução:");
    const statsAfter = await getReactivationStats();
    console.log(`  - Fila pendente: ${statsAfter.pendingQueue}`);
    console.log(`  - Enviadas hoje: ${statsAfter.sentToday}`);
    console.log(`  - Falhas hoje: ${statsAfter.failedToday}`);

    console.log("\n" + "=".repeat(60));
    console.log("CRONJOB FINALIZADO COM SUCESSO");
    console.log("=".repeat(60));

    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERRO NO CRONJOB:");
    console.error(error);
    process.exit(1);
  }
}

main();
