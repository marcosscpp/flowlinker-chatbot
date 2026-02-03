/**
 * Serviço para salvar mensagens no histórico
 * Salva tanto mensagens recebidas quanto enviadas (fromMe)
 */

import { prisma } from "../database/client.js";
import type { Prisma } from "@prisma/client";

interface MessageHistory {
  role: "user" | "assistant";
  content: string;
}

/**
 * Salva uma mensagem no histórico da conversa
 * Pode salvar mensagens do usuário ou do assistente/atendente
 */
export async function saveMessageToHistory(
  phone: string,
  content: string,
  role: "user" | "assistant",
  instance?: string
): Promise<void> {
  try {
    const now = new Date();

    // Busca histórico existente
    const log = await prisma.conversationLog.findUnique({
      where: { phone },
    });

    let history: MessageHistory[] = [];
    if (log?.messages) {
      history = log.messages as unknown as MessageHistory[];
    }

    // Adiciona nova mensagem
    history.push({ role, content });

    // Limita histórico a 20 mensagens
    const limitedHistory = history.slice(-20);

    // Salva no banco
    await prisma.conversationLog.upsert({
      where: { phone },
      create: {
        phone,
        messages: limitedHistory as unknown as Prisma.InputJsonValue,
        lastContactAt: now,
        firstContactInstance: instance,
        lastContactInstance: instance,
      } as any,
      update: {
        messages: limitedHistory as unknown as Prisma.InputJsonValue,
        lastContactAt: now,
        lastContactInstance: instance,
      } as any,
    });

    console.log(
      `[MessageHistory] Mensagem salva (${role}) para ${phone}: "${content.substring(0, 30)}..."`
    );
  } catch (error) {
    console.error(`[MessageHistory] Erro ao salvar mensagem para ${phone}:`, error);
  }
}

/**
 * Verifica se o bot está desabilitado para este telefone
 */
export async function isBotDisabled(phone: string): Promise<boolean> {
  const conversation = await prisma.conversationLog.findUnique({
    where: { phone },
    select: { disabled: true },
  });
  return conversation?.disabled ?? false;
}
