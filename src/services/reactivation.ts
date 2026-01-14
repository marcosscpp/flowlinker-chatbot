import { prisma } from "../database/client.js";
import { sendText } from "./evolution.js";
import { getDefaultInstance } from "../config/instances.js";
import {
  analyzeConversation,
  findContactsToReactivate,
  markReactivationAttempt,
  discardContact,
  updateConversationStatus,
  type ConversationAnalysis,
} from "./reactivation-analyzer.js";

/**
 * Configurações de reativação
 */
export interface ReactivationConfig {
  inactiveDays: number; // Dias sem contato para considerar inativo
  maxAttempts: number; // Máximo de tentativas de reativação
  dailyLimit: number; // Limite diário de mensagens
  delayBetweenMessages: number; // Delay em ms entre mensagens (recomendado: 30-60 segundos)
  instance: string; // Instância do Evolution API
}

const DEFAULT_CONFIG: ReactivationConfig = {
  inactiveDays: 2,
  maxAttempts: 3,
  dailyLimit: 60,
  delayBetweenMessages: 45000, // 45 segundos
  instance: getDefaultInstance(),
};

/**
 * Resultado do processamento de reativação
 */
export interface ReactivationResult {
  totalAnalyzed: number;
  queued: number;
  discarded: number;
  skipped: number;
  errors: number;
  details: Array<{
    phone: string;
    action: "queued" | "discarded" | "skipped" | "error";
    reason: string;
  }>;
}

/**
 * Resultado do envio de mensagens da fila
 */
export interface SendQueueResult {
  sent: number;
  failed: number;
  remaining: number;
  details: Array<{
    phone: string;
    status: "sent" | "failed";
    error?: string;
  }>;
}

/**
 * Adiciona contato à fila de reativação
 */
export async function queueReactivation(
  phone: string,
  message: string,
  attempt: number,
  instance: string,
  scheduledAt: Date = new Date()
): Promise<void> {
  // Busca o conversationLog para associar
  const log = await prisma.conversationLog.findUnique({
    where: { phone },
  });

  if (!log) {
    throw new Error(`ConversationLog não encontrado para ${phone}`);
  }

  await prisma.reactivationQueue.create({
    data: {
      phone,
      message,
      instance,
      attempt,
      scheduledAt,
      status: "PENDING",
      conversationLogId: log.id,
    },
  });
}

/**
 * Cancela mensagens pendentes para um telefone
 * (usado quando o contato responde antes do envio)
 */
export async function cancelPendingReactivations(phone: string): Promise<number> {
  const result = await prisma.reactivationQueue.updateMany({
    where: {
      phone,
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
    },
  });

  return result.count;
}

/**
 * Analisa e enfileira contatos para reativação
 * Esta função deve ser chamada pelo cronjob de análise
 */
export async function analyzeAndQueueContacts(
  config: Partial<ReactivationConfig> = {}
): Promise<ReactivationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  console.log("[Reactivation] Iniciando análise de contatos...");
  console.log(`[Reactivation] Config: ${JSON.stringify(cfg)}`);

  const result: ReactivationResult = {
    totalAnalyzed: 0,
    queued: 0,
    discarded: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  // Verifica quantas mensagens já foram enviadas/enfileiradas hoje
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCount = await prisma.reactivationQueue.count({
    where: {
      createdAt: { gte: today },
      status: { in: ["PENDING", "SENT"] },
    },
  });

  const remainingLimit = cfg.dailyLimit - todayCount;

  if (remainingLimit <= 0) {
    console.log("[Reactivation] Limite diário atingido, nenhum contato será processado");
    return result;
  }

  // Busca contatos elegíveis
  const contacts = await findContactsToReactivate(
    cfg.inactiveDays,
    cfg.maxAttempts,
    remainingLimit
  );

  console.log(`[Reactivation] ${contacts.length} contatos elegíveis encontrados`);

  // Analisa e enfileira cada contato
  for (const contact of contacts) {
    result.totalAnalyzed++;

    try {
      const analysis = await analyzeConversation(
        contact.phone,
        contact.reactivationAttempts + 1
      );

      console.log(`[Reactivation] ${contact.phone}: stage=${analysis.stage}, shouldReactivate=${analysis.shouldReactivate}`);

      if (!analysis.shouldReactivate) {
        // Descarta o contato
        if (analysis.discardReason) {
          await discardContact(contact.phone, analysis.discardReason);
          result.discarded++;
          result.details.push({
            phone: contact.phone,
            action: "discarded",
            reason: analysis.discardReason,
          });
        } else {
          result.skipped++;
          result.details.push({
            phone: contact.phone,
            action: "skipped",
            reason: analysis.summary,
          });
        }
        continue;
      }

      if (!analysis.reactivationMessage) {
        result.skipped++;
        result.details.push({
          phone: contact.phone,
          action: "skipped",
          reason: "Sem mensagem de reativação gerada",
        });
        continue;
      }

      // Verifica se o contato já está na fila pendente (evita duplicatas)
      const existingInQueue = await prisma.reactivationQueue.findFirst({
        where: {
          phone: contact.phone,
          status: "PENDING",
        },
      });

      if (existingInQueue) {
        result.skipped++;
        result.details.push({
          phone: contact.phone,
          action: "skipped",
          reason: "Já está na fila de reativação pendente",
        });
        console.log(`[Reactivation] ${contact.phone}: pulado - já está na fila pendente`);
        continue;
      }

      // Calcula horário de envio com base na posição na fila
      const scheduledAt = new Date();
      scheduledAt.setMilliseconds(
        scheduledAt.getMilliseconds() + (result.queued * cfg.delayBetweenMessages)
      );

      // Adiciona à fila
      await queueReactivation(
        contact.phone,
        analysis.reactivationMessage,
        contact.reactivationAttempts + 1,
        cfg.instance,
        scheduledAt
      );

      // Atualiza status da conversa
      await updateConversationStatus(
        contact.phone,
        analysis.stage,
        "REACTIVATING"
      );

      result.queued++;
      result.details.push({
        phone: contact.phone,
        action: "queued",
        reason: `Estágio: ${analysis.stage}. Mensagem: ${analysis.reactivationMessage}`,
      });
    } catch (error) {
      console.error(`[Reactivation] Erro ao processar ${contact.phone}:`, error);
      result.errors++;
      result.details.push({
        phone: contact.phone,
        action: "error",
        reason: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  console.log(`[Reactivation] Análise finalizada:`, result);
  return result;
}

/**
 * Processa a fila de envio de mensagens
 * Esta função deve ser chamada pelo cronjob de envio
 */
export async function processReactivationQueue(
  config: Partial<ReactivationConfig> = {}
): Promise<SendQueueResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  console.log("[Reactivation] Processando fila de envio...");

  const result: SendQueueResult = {
    sent: 0,
    failed: 0,
    remaining: 0,
    details: [],
  };

  // Busca mensagens pendentes que já podem ser enviadas
  const now = new Date();
  const pendingMessages = await prisma.reactivationQueue.findMany({
    where: {
      status: "PENDING",
      scheduledAt: { lte: now },
    },
    orderBy: [
      { priority: "desc" },
      { scheduledAt: "asc" },
    ],
    take: 10, // Processa em lotes pequenos
  });

  console.log(`[Reactivation] ${pendingMessages.length} mensagens prontas para envio`);

  for (const msg of pendingMessages) {
    try {
      // Verifica se o contato não respondeu enquanto estava na fila
      const conversationLog = await prisma.conversationLog.findUnique({
        where: { phone: msg.phone },
      });

      // Se o contato respondeu (lastContactAt > createdAt da mensagem), cancela
      if (conversationLog && conversationLog.lastContactAt > msg.createdAt) {
        await prisma.reactivationQueue.update({
          where: { id: msg.id },
          data: {
            status: "CANCELLED",
            errorMessage: "Contato respondeu antes do envio",
          },
        });
        console.log(`[Reactivation] ${msg.phone}: cancelado - contato já respondeu`);
        continue;
      }

      // Envia a mensagem
      await sendText(msg.instance, msg.phone, msg.message);

      // Marca como enviada
      await prisma.reactivationQueue.update({
        where: { id: msg.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });

      // Atualiza tentativas de reativação
      await markReactivationAttempt(msg.phone);

      result.sent++;
      result.details.push({
        phone: msg.phone,
        status: "sent",
      });

      console.log(`[Reactivation] ${msg.phone}: enviado com sucesso`);

      // Delay entre mensagens para evitar banimento
      if (pendingMessages.indexOf(msg) < pendingMessages.length - 1) {
        await sleep(cfg.delayBetweenMessages);
      }
    } catch (error) {
      console.error(`[Reactivation] Erro ao enviar para ${msg.phone}:`, error);

      // Marca como falhou
      await prisma.reactivationQueue.update({
        where: { id: msg.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
        },
      });

      result.failed++;
      result.details.push({
        phone: msg.phone,
        status: "failed",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  // Conta mensagens restantes
  result.remaining = await prisma.reactivationQueue.count({
    where: { status: "PENDING" },
  });

  console.log(`[Reactivation] Envio finalizado:`, result);
  return result;
}

/**
 * Executa todo o ciclo de reativação (análise + envio)
 * Esta é a função principal que o cronjob deve chamar
 */
export async function runReactivationCycle(
  config: Partial<ReactivationConfig> = {}
): Promise<{
  analysis: ReactivationResult;
  sending: SendQueueResult;
}> {
  console.log("[Reactivation] === Iniciando ciclo de reativação ===");

  // Primeiro, processa a fila existente
  const sending = await processReactivationQueue(config);

  // Depois, analisa novos contatos e enfileira
  const analysis = await analyzeAndQueueContacts(config);

  console.log("[Reactivation] === Ciclo de reativação finalizado ===");

  return { analysis, sending };
}

/**
 * Obtém estatísticas de reativação
 */
export async function getReactivationStats(): Promise<{
  pendingQueue: number;
  sentToday: number;
  failedToday: number;
  contactsReactivated: number;
  contactsDiscarded: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [pendingQueue, sentToday, failedToday, contactsReactivated, contactsDiscarded] =
    await Promise.all([
      prisma.reactivationQueue.count({ where: { status: "PENDING" } }),
      prisma.reactivationQueue.count({
        where: { status: "SENT", sentAt: { gte: today } },
      }),
      prisma.reactivationQueue.count({
        where: { status: "FAILED", updatedAt: { gte: today } },
      }),
      prisma.conversationLog.count({
        where: { conversationStatus: "REACTIVATING" },
      }),
      prisma.conversationLog.count({
        where: { conversationStatus: "DISCARDED" },
      }),
    ]);

  return {
    pendingQueue,
    sentToday,
    failedToday,
    contactsReactivated,
    contactsDiscarded,
  };
}

/**
 * Helper para delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
