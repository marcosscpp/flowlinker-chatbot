/**
 * Script para testar o chatbot no terminal
 * Simula conversas sem precisar do WhatsApp
 *
 * Uso: npx tsx scripts/test-chat.ts
 */

import * as readline from "readline";
import { processMessageDebug, clearHistory } from "../src/agent/index.js";

const TEST_PHONE = "5511999999999";
const TEST_NAME = "Cliente Teste";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║           TESTE DO CHATBOT FLOWLINKER                      ║");
console.log("╠════════════════════════════════════════════════════════════╣");
console.log("║  Comandos especiais:                                       ║");
console.log("║    /limpar  - Limpa histórico da conversa                  ║");
console.log("║    /sair    - Encerra o teste                              ║");
console.log("║    /info    - Mostra informações do teste                  ║");
console.log("╚════════════════════════════════════════════════════════════╝");
console.log("");
console.log(`Telefone simulado: ${TEST_PHONE}`);
console.log(`Nome simulado: ${TEST_NAME}`);
console.log("");
console.log("Digite sua mensagem (ou /sair para encerrar):");
console.log("─".repeat(60));

async function chat(userMessage: string): Promise<void> {
  // Comandos especiais
  if (userMessage.toLowerCase() === "/limpar") {
    await clearHistory(TEST_PHONE);
    console.log("\n🗑️  Histórico limpo!\n");
    return;
  }

  if (userMessage.toLowerCase() === "/sair") {
    console.log("\n👋 Até mais!\n");
    rl.close();
    process.exit(0);
  }

  if (userMessage.toLowerCase() === "/info") {
    console.log("\n📋 Informações do teste:");
    console.log(`   Telefone: ${TEST_PHONE}`);
    console.log(`   Nome: ${TEST_NAME}`);
    console.log(`   Modelo: gpt-4o`);
    console.log(`   Data/Hora: ${new Date().toLocaleString("pt-BR")}\n`);
    return;
  }

  try {
    console.log("\n⏳ Processando...\n");

    const startTime = Date.now();
    const { response, toolCalls } = await processMessageDebug(
      TEST_PHONE,
      userMessage,
      TEST_NAME
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Mostra tools chamadas
    if (toolCalls.length > 0) {
      console.log("┌─ TOOLS CHAMADAS ──────────────────────────────────────────┐");
      for (const tool of toolCalls) {
        console.log(`│ 🔧 ${tool.name}`);
        const argsStr = JSON.stringify(tool.args, null, 2)
          .split("\n")
          .map((line) => `│    ${line}`)
          .join("\n");
        console.log(argsStr);
      }
      console.log("└────────────────────────────────────────────────────────────┘");
      console.log("");
    }

    // Mostra resposta
    console.log("┌─ BOT ─────────────────────────────────────────────────────┐");
    console.log("");
    console.log(response);
    console.log("");
    console.log(`└─────────────────────────────────────── (${duration}s) ──┘`);
    console.log("");
  } catch (error: any) {
    console.error("\n❌ Erro:", error.message, "\n");
  }
}

function prompt(): void {
  rl.question("Você: ", async (input) => {
    const trimmed = input.trim();
    if (trimmed) {
      await chat(trimmed);
    }
    prompt();
  });
}

// Limpa histórico ao iniciar para começar do zero
clearHistory(TEST_PHONE).then(() => {
  console.log("🔄 Histórico limpo para novo teste\n");
  prompt();
});
