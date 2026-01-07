/**
 * Serviço de Debounce para mensagens do WhatsApp
 *
 * Acumula mensagens do mesmo usuário e envia para processamento
 * após um período de inatividade (ex: 3 segundos).
 *
 * Isso evita múltiplas respostas quando o usuário envia várias
 * mensagens em sequência.
 */

import { env } from "../config/env.js";
import * as queueService from "./queue.js";

// Tempo de espera antes de processar (em ms)
// Configurável via DEBOUNCE_DELAY no .env (padrão: 3000ms)
const DEBOUNCE_DELAY = env.debounceDelay;

interface PendingMessage {
  phone: string;
  texts: string[];
  name?: string;
  messageIds: string[];
  firstTimestamp: number;
  timer: NodeJS.Timeout;
}

// Buffer de mensagens pendentes por telefone
const pendingMessages = new Map<string, PendingMessage>();

/**
 * Adiciona uma mensagem ao buffer de debounce
 * Se já houver mensagens pendentes do mesmo usuário, concatena
 * Reseta o timer a cada nova mensagem
 */
export function addMessage(data: {
  phone: string;
  text: string;
  name?: string;
  messageId: string;
  timestamp: number;
}): void {
  const { phone, text, name, messageId, timestamp } = data;

  const existing = pendingMessages.get(phone);

  if (existing) {
    // Já tem mensagens pendentes - adiciona ao buffer e reseta timer
    existing.texts.push(text);
    existing.messageIds.push(messageId);
    if (name && !existing.name) {
      existing.name = name;
    }

    // Cancela timer anterior
    clearTimeout(existing.timer);

    // Cria novo timer
    existing.timer = setTimeout(() => {
      flushMessages(phone);
    }, DEBOUNCE_DELAY);

    console.log(
      `[Debounce] Mensagem acumulada para ${phone} (${existing.texts.length} msgs)`
    );
  } else {
    // Primeira mensagem - cria entrada no buffer
    const timer = setTimeout(() => {
      flushMessages(phone);
    }, DEBOUNCE_DELAY);

    pendingMessages.set(phone, {
      phone,
      texts: [text],
      name,
      messageIds: [messageId],
      firstTimestamp: timestamp,
      timer,
    });

    console.log(`[Debounce] Nova mensagem de ${phone}, aguardando ${DEBOUNCE_DELAY}ms...`);
  }
}

/**
 * Processa mensagens acumuladas de um usuário
 * Concatena todas as mensagens e envia para a fila
 */
async function flushMessages(phone: string): Promise<void> {
  const pending = pendingMessages.get(phone);
  if (!pending) return;

  // Remove do buffer
  pendingMessages.delete(phone);

  // Concatena todas as mensagens
  const combinedText = pending.texts.join("\n");
  const combinedMessageId = pending.messageIds.join("_");

  console.log(
    `[Debounce] Processando ${pending.texts.length} mensagem(s) de ${phone}`
  );

  // Envia para a fila
  const queued = await queueService.publishMessage({
    phone: pending.phone,
    text: combinedText,
    name: pending.name,
    messageId: combinedMessageId,
    timestamp: pending.firstTimestamp,
  });

  if (!queued) {
    console.error(`[Debounce] Falha ao enfileirar mensagens de ${phone}`);
  }
}

/**
 * Retorna quantidade de usuários com mensagens pendentes
 */
export function getPendingCount(): number {
  return pendingMessages.size;
}

/**
 * Força o processamento imediato de todas as mensagens pendentes
 * Útil para graceful shutdown
 */
export async function flushAll(): Promise<void> {
  console.log(`[Debounce] Forçando flush de ${pendingMessages.size} usuários`);

  const phones = Array.from(pendingMessages.keys());

  for (const phone of phones) {
    const pending = pendingMessages.get(phone);
    if (pending) {
      clearTimeout(pending.timer);
      await flushMessages(phone);
    }
  }
}

