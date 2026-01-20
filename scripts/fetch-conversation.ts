/**
 * Script para buscar histórico de conversas de um número em todas as instâncias
 *
 * Uso:
 *   npx tsx scripts/fetch-conversation.ts <telefone>
 *
 * Exemplo:
 *   npx tsx scripts/fetch-conversation.ts 5511999999999
 */

import "dotenv/config";
import axios from "axios";
import { env } from "../src/config/env.js";
import { instances } from "../src/config/instances.js";

const api = axios.create({
  baseURL: env.evolutionApiUrl,
  headers: {
    apikey: env.evolutionApiKey,
    "Content-Type": "application/json",
  },
});

interface EvolutionMessage {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
  };
  messageTimestamp?: number | string;
  pushName?: string;
}

/**
 * Busca mensagens de um chat específico
 */
async function findMessages(
  instance: string,
  remoteJid: string,
  limit: number = 50
): Promise<EvolutionMessage[]> {
  try {
    const response = await api.post(`/chat/findMessages/${instance}`, {
      where: {
        key: {
          remoteJid,
        },
      },
      limit,
    });
    return response.data || [];
  } catch (error: any) {
    if (error.response?.status === 404) {
      return [];
    }
    console.error(`  Erro ao buscar mensagens em ${instance}:`, error.message);
    return [];
  }
}

/**
 * Extrai texto da mensagem
 */
function extractText(message: EvolutionMessage["message"]): string | null {
  if (!message) return null;
  return message.conversation || message.extendedTextMessage?.text || null;
}

/**
 * Formata timestamp para data legível
 */
function formatTimestamp(timestamp: number | string | undefined): string {
  if (!timestamp) return "??/??/???? ??:??";

  const ts = typeof timestamp === "string" ? parseInt(timestamp, 10) * 1000 : timestamp * 1000;
  const date = new Date(ts);

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formata número para remoteJid
 */
function formatToJid(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  return `${cleaned}@s.whatsapp.net`;
}

/**
 * Imprime separador
 */
function printSeparator(char: string = "=", length: number = 70): void {
  console.log(char.repeat(length));
}

/**
 * Imprime cabeçalho
 */
function printHeader(text: string): void {
  printSeparator();
  console.log(`  ${text}`);
  printSeparator();
}

/**
 * Imprime mensagem formatada
 */
function printMessage(msg: EvolutionMessage, index: number): void {
  const text = extractText(msg.message);
  const time = formatTimestamp(msg.messageTimestamp);
  const sender = msg.key.fromMe ? "BOT" : "LEAD";
  const name = msg.pushName ? ` (${msg.pushName})` : "";

  const prefix = msg.key.fromMe ? "\x1b[36m>>>\x1b[0m" : "\x1b[33m<<<\x1b[0m";
  const senderColor = msg.key.fromMe ? "\x1b[36m" : "\x1b[33m";

  console.log(`\n  ${prefix} [${time}] ${senderColor}${sender}${name}\x1b[0m`);

  if (text) {
    const lines = text.split("\n");
    lines.forEach((line) => {
      console.log(`      ${line}`);
    });
  } else {
    console.log(`      \x1b[90m[Mensagem sem texto - mídia ou outro tipo]\x1b[0m`);
  }
}

async function main(): Promise<void> {
  const phone = process.argv[2];

  if (!phone) {
    console.log("\n  Uso: npx tsx scripts/fetch-conversation.ts <telefone>");
    console.log("  Exemplo: npx tsx scripts/fetch-conversation.ts 5511999999999\n");
    process.exit(1);
  }

  const remoteJid = formatToJid(phone);

  console.log("\n");
  printHeader(`HISTÓRICO DE CONVERSAS - ${phone}`);
  console.log(`  RemoteJid: ${remoteJid}`);
  console.log(`  Instâncias configuradas: ${instances.map((i) => i.name).join(", ")}`);
  console.log(`  Data da consulta: ${new Date().toLocaleString("pt-BR")}`);
  printSeparator();

  let totalMessages = 0;
  const instancesWithMessages: string[] = [];

  for (const instance of instances) {
    console.log(`\n\x1b[1m  Buscando em: ${instance.name}\x1b[0m`);
    console.log(`  ${instance.description || ""}`);
    console.log("  " + "-".repeat(50));

    const messages = await findMessages(instance.name, remoteJid, 100);

    if (messages.length === 0) {
      console.log("  \x1b[90mNenhuma mensagem encontrada nesta instância\x1b[0m");
      continue;
    }

    instancesWithMessages.push(instance.name);
    totalMessages += messages.length;

    // Ordena por timestamp (mais antiga primeiro)
    const sortedMessages = messages.sort((a, b) => {
      const tsA =
        typeof a.messageTimestamp === "string"
          ? parseInt(a.messageTimestamp, 10)
          : a.messageTimestamp || 0;
      const tsB =
        typeof b.messageTimestamp === "string"
          ? parseInt(b.messageTimestamp, 10)
          : b.messageTimestamp || 0;
      return tsA - tsB;
    });

    // Encontra primeira e última mensagem
    const firstMsg = sortedMessages[0];
    const lastMsg = sortedMessages[sortedMessages.length - 1];

    console.log(`  Mensagens encontradas: \x1b[32m${messages.length}\x1b[0m`);
    console.log(`  Primeiro contato: ${formatTimestamp(firstMsg?.messageTimestamp)}`);
    console.log(`  Último contato: ${formatTimestamp(lastMsg?.messageTimestamp)}`);

    // Imprime todas as mensagens
    sortedMessages.forEach((msg, index) => {
      printMessage(msg, index);
    });
  }

  // Resumo final
  console.log("\n");
  printSeparator("=");
  console.log("  RESUMO");
  printSeparator("-");
  console.log(`  Total de mensagens: ${totalMessages}`);
  console.log(`  Instâncias com histórico: ${instancesWithMessages.length > 0 ? instancesWithMessages.join(", ") : "Nenhuma"}`);

  if (instancesWithMessages.length > 0) {
    console.log(`\n  \x1b[32mPrimeiro contato feito pela instância:\x1b[0m`);
    console.log(`    -> Verifique a data mais antiga acima para identificar`);

    console.log(`\n  \x1b[33mÚltimo contato feito pela instância:\x1b[0m`);
    console.log(`    -> Verifique a data mais recente acima para identificar`);
  }

  printSeparator("=");
  console.log("\n");

  process.exit(0);
}

main().catch((error) => {
  console.error("\nErro ao executar script:", error);
  process.exit(1);
});
