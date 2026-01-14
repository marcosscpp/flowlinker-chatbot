/**
 * Service para recuperar mensagens perdidas enquanto o WhatsApp estava offline
 *
 * Quando o número desconecta, as mensagens enviadas pelos clientes não chegam ao webhook.
 * Este service busca essas mensagens diretamente do Evolution API e as processa.
 */

import axios from "axios";
import { env } from "../config/env.js";
import { prisma } from "../database/client.js";
import { instances, getDefaultInstance } from "../config/instances.js";
import * as queueService from "./queue.js";

const api = axios.create({
  baseURL: env.evolutionApiUrl,
  headers: {
    apikey: env.evolutionApiKey,
    "Content-Type": "application/json",
  },
});

interface EvolutionChat {
  id: string;
  remoteJid: string;
  pushName?: string;
  profilePicUrl?: string;
  updatedAt?: string;
  unreadCount?: number;
}

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
 * Busca todos os chats de uma instância
 */
async function findChats(instance: string): Promise<EvolutionChat[]> {
  try {
    const response = await api.post(`/chat/findChats/${instance}`, {});
    return response.data || [];
  } catch (error: any) {
    console.error(`[OfflineRecovery] Erro ao buscar chats de ${instance}:`, error.message);
    return [];
  }
}

/**
 * Busca mensagens de um chat específico
 */
async function findMessages(
  instance: string,
  remoteJid: string,
  limit: number = 20
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
    console.error(`[OfflineRecovery] Erro ao buscar mensagens de ${remoteJid}:`, error.message);
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
 * Extrai telefone do JID
 */
function extractPhone(remoteJid: string): string {
  return remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
}

/**
 * Resultado da recuperação de mensagens offline
 */
export interface OfflineRecoveryResult {
  instance: string;
  chatsScanned: number;
  messagesFound: number;
  messagesProcessed: number;
  errors: number;
  details: Array<{
    phone: string;
    messagesRecovered: number;
  }>;
}

/**
 * Recupera mensagens perdidas de uma instância
 *
 * @param instance Nome da instância do Evolution API
 * @param hoursBack Quantas horas para trás buscar (default: 48h)
 */
export async function recoverOfflineMessages(
  instance: string,
  hoursBack: number = 48
): Promise<OfflineRecoveryResult> {
  console.log(`[OfflineRecovery] Iniciando recuperação para ${instance} (últimas ${hoursBack}h)`);

  const result: OfflineRecoveryResult = {
    instance,
    chatsScanned: 0,
    messagesFound: 0,
    messagesProcessed: 0,
    errors: 0,
    details: [],
  };

  const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000;

  try {
    // Busca todos os chats
    const chats = await findChats(instance);
    result.chatsScanned = chats.length;

    console.log(`[OfflineRecovery] ${chats.length} chats encontrados em ${instance}`);

    for (const chat of chats) {
      // Ignora grupos
      if (chat.remoteJid.endsWith("@g.us")) continue;

      const phone = extractPhone(chat.remoteJid);

      // Busca histórico de conversa no banco
      const conversationLog = await prisma.conversationLog.findUnique({
        where: { phone },
        select: { lastContactAt: true, messages: true },
      });

      // Busca últimas mensagens do Evolution
      const messages = await findMessages(instance, chat.remoteJid, 30);

      // Filtra mensagens que:
      // 1. Não são do bot (fromMe = false)
      // 2. São recentes (dentro do período de busca)
      // 3. Não foram processadas (timestamp > lastContactAt do banco)
      const lastContactAt = conversationLog?.lastContactAt?.getTime() || 0;

      const unprocessedMessages = messages.filter((msg) => {
        if (msg.key.fromMe) return false;

        const msgTimestamp =
          typeof msg.messageTimestamp === "string"
            ? parseInt(msg.messageTimestamp, 10) * 1000
            : (msg.messageTimestamp || 0) * 1000;

        // Mensagem é recente E posterior ao último contato registrado
        return msgTimestamp > cutoffTime && msgTimestamp > lastContactAt;
      });

      result.messagesFound += unprocessedMessages.length;

      if (unprocessedMessages.length === 0) continue;

      console.log(`[OfflineRecovery] ${phone}: ${unprocessedMessages.length} mensagens não processadas`);

      let messagesRecovered = 0;

      // Processa mensagens não processadas (da mais antiga para a mais nova)
      const sortedMessages = unprocessedMessages.sort((a, b) => {
        const tsA = typeof a.messageTimestamp === "string"
          ? parseInt(a.messageTimestamp, 10)
          : (a.messageTimestamp || 0);
        const tsB = typeof b.messageTimestamp === "string"
          ? parseInt(b.messageTimestamp, 10)
          : (b.messageTimestamp || 0);
        return tsA - tsB;
      });

      for (const msg of sortedMessages) {
        const text = extractText(msg.message);
        if (!text) continue;

        try {
          // Publica na fila para processamento normal
          await queueService.publishMessage({
            instance,
            phone,
            text,
            name: msg.pushName || chat.pushName,
            messageId: msg.key.id,
            timestamp: typeof msg.messageTimestamp === "string"
              ? parseInt(msg.messageTimestamp, 10) * 1000
              : (msg.messageTimestamp || 0) * 1000,
          });

          messagesRecovered++;
          result.messagesProcessed++;
        } catch (err) {
          console.error(`[OfflineRecovery] Erro ao processar mensagem de ${phone}:`, err);
          result.errors++;
        }
      }

      if (messagesRecovered > 0) {
        result.details.push({ phone, messagesRecovered });
      }
    }
  } catch (error) {
    console.error(`[OfflineRecovery] Erro geral:`, error);
    result.errors++;
  }

  console.log(`[OfflineRecovery] Recuperação finalizada:`, result);
  return result;
}

/**
 * Recupera mensagens offline de todas as instâncias configuradas
 */
export async function recoverAllInstances(
  hoursBack: number = 48
): Promise<OfflineRecoveryResult[]> {
  const results: OfflineRecoveryResult[] = [];

  for (const instance of instances) {
    const result = await recoverOfflineMessages(instance.name, hoursBack);
    results.push(result);
  }

  return results;
}

/**
 * Verifica se há conexão ativa com o Evolution API
 */
export async function checkConnection(instance: string): Promise<boolean> {
  try {
    const response = await api.get(`/instance/connectionState/${instance}`);
    return response.data?.state === "open";
  } catch {
    return false;
  }
}
