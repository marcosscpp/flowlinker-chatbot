/**
 * Script para sincronizar histórico de conversas com Evolution API
 *
 * Busca mensagens do WhatsApp e atualiza o banco de dados com mensagens faltantes.
 *
 * Uso:
 *   npx tsx scripts/sync-conversations.ts [--hours=48] [--instance=nome]
 *
 * Exemplos:
 *   npx tsx scripts/sync-conversations.ts                    # Últimas 48h, todas instâncias
 *   npx tsx scripts/sync-conversations.ts --hours=24         # Últimas 24h
 *   npx tsx scripts/sync-conversations.ts --instance=bot1    # Instância específica
 */

import "dotenv/config";
import { prisma } from "../src/database/client.js";
import { env } from "../src/config/env.js";
import { getAllInstances } from "../src/config/instances.js";

interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
  };
  messageTimestamp: number | string;
}

interface EvolutionChat {
  id: string;
  name?: string;
}

interface SyncResult {
  instance: string;
  chatsScanned: number;
  messagesFound: number;
  messagesAdded: number;
  conversationsUpdated: number;
  errors: number;
  details: Array<{
    phone: string;
    messagesBefore: number;
    messagesAfter: number;
    added: number;
  }>;
}

/**
 * Extrai número de telefone do remoteJid
 */
function extractPhone(remoteJid: string): string | null {
  if (!remoteJid || remoteJid.includes("@g.us")) return null; // Ignora grupos
  const match = remoteJid.match(/^(\d+)@/);
  return match ? match[1] : null;
}

/**
 * Extrai texto da mensagem
 */
function extractMessageText(message: EvolutionMessage["message"]): string | null {
  if (!message) return null;
  return message.conversation || message.extendedTextMessage?.text || null;
}

/**
 * Busca chats do Evolution API
 */
async function fetchChats(instance: string): Promise<EvolutionChat[]> {
  const response = await fetch(
    `${env.evolutionApiUrl}/chat/findChats/${instance}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.evolutionApiKey,
      },
      body: JSON.stringify({}),
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar chats: ${response.status}`);
  }

  return response.json();
}

/**
 * Busca mensagens de um chat específico
 */
async function fetchMessages(
  instance: string,
  remoteJid: string,
  limit: number = 100
): Promise<EvolutionMessage[]> {
  const response = await fetch(
    `${env.evolutionApiUrl}/chat/findMessages/${instance}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.evolutionApiKey,
      },
      body: JSON.stringify({
        where: {
          key: { remoteJid },
        },
        limit,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar mensagens: ${response.status}`);
  }

  const data = await response.json();
  return data.messages?.records || data.messages || data || [];
}

/**
 * Sincroniza conversas de uma instância
 */
async function syncInstance(instance: string, hoursBack: number): Promise<SyncResult> {
  const result: SyncResult = {
    instance,
    chatsScanned: 0,
    messagesFound: 0,
    messagesAdded: 0,
    conversationsUpdated: 0,
    errors: 0,
    details: [],
  };

  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

  console.log(`\n[${instance}] Buscando chats...`);

  let chats: EvolutionChat[];
  try {
    chats = await fetchChats(instance);
    console.log(`[${instance}] ${chats.length} chats encontrados`);
  } catch (error) {
    console.error(`[${instance}] Erro ao buscar chats:`, error);
    result.errors++;
    return result;
  }

  for (const chat of chats) {
    const phone = extractPhone(chat.id);
    if (!phone) continue;

    result.chatsScanned++;
    process.stdout.write(`\r[${instance}] Processando ${result.chatsScanned}/${chats.length}: ${phone}...`);

    try {
      // Busca conversa no banco
      const conversationLog = await prisma.conversationLog.findUnique({
        where: { phone },
      });

      if (!conversationLog) {
        // Conversa não existe no banco, pula
        continue;
      }

      // Busca mensagens do Evolution
      const evolutionMessages = await fetchMessages(instance, chat.id, 50);

      if (!evolutionMessages || evolutionMessages.length === 0) continue;

      result.messagesFound += evolutionMessages.length;

      // Mensagens atuais no banco
      const currentMessages = (conversationLog.messages as Array<{ role: string; content: string; timestamp?: number }>) || [];
      const messagesBefore = currentMessages.length;

      // Cria um Set de conteúdos existentes para comparação rápida
      const existingContents = new Set(currentMessages.map(m => m.content.trim().toLowerCase()));

      // Filtra mensagens novas do Evolution
      const newMessages: Array<{ role: string; content: string; timestamp: number }> = [];

      for (const msg of evolutionMessages) {
        const timestamp = typeof msg.messageTimestamp === "string"
          ? parseInt(msg.messageTimestamp) * 1000
          : msg.messageTimestamp * 1000;

        // Ignora mensagens muito antigas
        if (timestamp < cutoffTime.getTime()) continue;

        const text = extractMessageText(msg.message);
        if (!text || text.trim().length === 0) continue;

        const normalizedText = text.trim().toLowerCase();

        // Verifica se mensagem já existe
        if (existingContents.has(normalizedText)) continue;

        const role = msg.key.fromMe ? "assistant" : "user";
        newMessages.push({
          role,
          content: text.trim(),
          timestamp,
        });

        existingContents.add(normalizedText);
      }

      if (newMessages.length === 0) continue;

      // Ordena novas mensagens por timestamp
      newMessages.sort((a, b) => a.timestamp - b.timestamp);

      // Combina mensagens existentes com novas
      const allMessages = [...currentMessages];
      for (const msg of newMessages) {
        allMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }

      // Limita a 50 mensagens (mantém as mais recentes)
      const limitedMessages = allMessages.slice(-50);

      // Atualiza no banco
      await prisma.conversationLog.update({
        where: { phone },
        data: {
          messages: limitedMessages as any,
          lastContactAt: new Date(),
        },
      });

      result.messagesAdded += newMessages.length;
      result.conversationsUpdated++;
      result.details.push({
        phone,
        messagesBefore,
        messagesAfter: limitedMessages.length,
        added: newMessages.length,
      });

    } catch (error) {
      result.errors++;
    }
  }

  console.log(""); // Nova linha após progresso

  return result;
}

/**
 * Parse argumentos da CLI
 */
function parseArgs(): { hours: number; instance?: string } {
  const args = process.argv.slice(2);
  let hours = 48;
  let instance: string | undefined;

  for (const arg of args) {
    if (arg.startsWith("--hours=")) {
      hours = parseInt(arg.replace("--hours=", ""), 10);
    } else if (arg.startsWith("--instance=")) {
      instance = arg.replace("--instance=", "");
    }
  }

  return { hours, instance };
}

async function main() {
  const { hours, instance } = parseArgs();

  console.log("=".repeat(70));
  console.log("SINCRONIZACAO DE HISTORICO DE CONVERSAS");
  console.log("=".repeat(70));
  console.log(`\nPeriodo: ultimas ${hours} horas`);
  console.log(`Instancia: ${instance || "todas"}\n`);

  const instances = instance ? [instance] : getAllInstances();
  const allResults: SyncResult[] = [];

  for (const inst of instances) {
    try {
      const result = await syncInstance(inst, hours);
      allResults.push(result);
    } catch (error) {
      console.error(`[${inst}] Erro fatal:`, error);
      allResults.push({
        instance: inst,
        chatsScanned: 0,
        messagesFound: 0,
        messagesAdded: 0,
        conversationsUpdated: 0,
        errors: 1,
        details: [],
      });
    }
  }

  // Resumo
  console.log("\n" + "=".repeat(70));
  console.log("RESUMO DA SINCRONIZACAO");
  console.log("=".repeat(70));

  let totalChats = 0;
  let totalMessagesFound = 0;
  let totalMessagesAdded = 0;
  let totalConversationsUpdated = 0;
  let totalErrors = 0;

  for (const result of allResults) {
    console.log(`\n[${result.instance}]`);
    console.log(`  Chats escaneados: ${result.chatsScanned}`);
    console.log(`  Mensagens encontradas: ${result.messagesFound}`);
    console.log(`  Mensagens adicionadas: ${result.messagesAdded}`);
    console.log(`  Conversas atualizadas: ${result.conversationsUpdated}`);
    console.log(`  Erros: ${result.errors}`);

    totalChats += result.chatsScanned;
    totalMessagesFound += result.messagesFound;
    totalMessagesAdded += result.messagesAdded;
    totalConversationsUpdated += result.conversationsUpdated;
    totalErrors += result.errors;

    if (result.details.length > 0) {
      console.log("\n  Detalhes das atualizacoes:");
      for (const detail of result.details) {
        console.log(`    ${detail.phone}: +${detail.added} mensagens (${detail.messagesBefore} -> ${detail.messagesAfter})`);
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("TOTAIS");
  console.log("=".repeat(70));
  console.log(`Chats escaneados: ${totalChats}`);
  console.log(`Mensagens encontradas: ${totalMessagesFound}`);
  console.log(`Mensagens adicionadas: ${totalMessagesAdded}`);
  console.log(`Conversas atualizadas: ${totalConversationsUpdated}`);
  console.log(`Erros: ${totalErrors}`);
  console.log("=".repeat(70));

  process.exit(0);
}

main().catch((error) => {
  console.error("Erro fatal:", error);
  process.exit(1);
});
