/**
 * Worker que processa mensagens da fila RabbitMQ
 *
 * Pode rodar em paralelo com o servidor principal para escalar horizontalmente.
 * Execute: npm run worker
 *
 * Comandos especiais:
 * - "." → Desabilita o bot para esta conversa
 * - ".." → Reabilita o bot para esta conversa
 */

import "dotenv/config";
import * as queueService from "./services/queue.js";
import * as evolutionService from "./services/evolution.js";
import { processMessage } from "./agent/index.js";
import { prisma } from "./database/client.js";
import { cancelPendingReactivations } from "./services/reactivation.js";

/**
 * Verifica se o bot está desabilitado para este telefone
 */
async function isBotDisabled(phone: string): Promise<boolean> {
  const conversation = await prisma.conversationLog.findUnique({
    where: { phone },
    select: { disabled: true },
  });
  return conversation?.disabled ?? false;
}

/**
 * Atualiza o estado disabled do bot para este telefone
 */
async function setBotDisabled(phone: string, disabled: boolean): Promise<void> {
  await prisma.conversationLog.upsert({
    where: { phone },
    update: { disabled },
    create: {
      phone,
      disabled,
      messages: [],
    },
  });
}

/**
 * Atualiza status da conversa para ACTIVE e cancela reativações pendentes
 */
async function onClientResponse(phone: string): Promise<void> {
  try {
    // Cancela mensagens de reativação pendentes (cliente respondeu)
    const cancelled = await cancelPendingReactivations(phone);
    if (cancelled > 0) {
      console.log(`[Worker] ${cancelled} reativação(ões) pendente(s) cancelada(s) para ${phone}`);
    }

    // Atualiza status para ACTIVE (cliente está respondendo)
    await prisma.conversationLog.updateMany({
      where: {
        phone,
        conversationStatus: { in: ["INACTIVE", "REACTIVATING"] },
      },
      data: {
        conversationStatus: "ACTIVE",
      },
    });
  } catch (err) {
    console.error(`[Worker] Erro ao processar resposta do cliente ${phone}:`, err);
  }
}

async function handleMessage(data: {
  instance: string;
  phone: string;
  text: string;
  name?: string;
  messageId: string;
  timestamp: number;
}): Promise<void> {
  const { instance, phone, text, name } = data;
  const trimmedText = text.trim();

  console.log(
    `[Worker] Processando mensagem de ${phone}@${instance}: "${trimmedText.substring(
      0,
      30
    )}..."`
  );

  // Atualiza status e cancela reativações pendentes (cliente respondeu)
  await onClientResponse(phone);

  // Comando "." → Desabilita o bot
  if (trimmedText === ".") {
    await setBotDisabled(phone, true);
    console.log(`[Worker] Bot DESABILITADO para ${phone}`);
    return; // Não responde nada, só desabilita
  }

  // Comando ".." → Reabilita o bot
  if (trimmedText === "..") {
    await setBotDisabled(phone, false);
    console.log(`[Worker] Bot REABILITADO para ${phone}`);
    // Não responde nada, só reabilita
    return;
  }

  // Verifica se o bot está desabilitado para este telefone
  const disabled = await isBotDisabled(phone);
  if (disabled) {
    console.log(`[Worker] Bot desabilitado para ${phone}, ignorando mensagem`);
    return; // Não processa nem responde
  }

  const startTime = Date.now();

  try {
    // Processa com o agente (passa instância para rastrear origem do contato)
    const response = await processMessage(phone, text, name, instance);

    // Envia resposta via WhatsApp pela mesma instância que recebeu
    await evolutionService.sendText(instance, phone, response);

    const elapsed = Date.now() - startTime;
    console.log(`[Worker] Resposta enviada para ${phone}@${instance} (${elapsed}ms)`);
  } catch (error) {
    console.error(`[Worker] Erro ao processar mensagem de ${phone}@${instance}:`, error);
    throw error; // Re-throw para que a mensagem va para DLQ
  }
}

async function start(): Promise<void> {
  console.log("[Worker] Iniciando...");

  // Conecta ao RabbitMQ
  await queueService.connect();

  // Inicia o consumidor
  await queueService.consumeMessages(handleMessage);

  console.log("[Worker] Aguardando mensagens...");

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n[Worker] Encerrando...");
    await queueService.disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n[Worker] Encerrando...");
    await queueService.disconnect();
    process.exit(0);
  });
}

start().catch((error) => {
  console.error("[Worker] Erro fatal:", error);
  process.exit(1);
});
