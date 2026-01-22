import { ChatOpenAI } from "@langchain/openai";
import { createHash } from "crypto";
import { env } from "../config/env.js";
import { prisma } from "../database/client.js";

// Modelo para geração de resumos (usa gpt-4o-mini para economia)
const summaryModel = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
  apiKey: env.openaiApiKey,
});

/**
 * Resultado da geração de resumo
 */
export interface ConversationSummaryResult {
  summary: string;
  keyPoints: string[];
  sentiment: "positivo" | "neutro" | "negativo";
  isCached: boolean;
}

/**
 * Prompt para geração de resumo
 */
const SUMMARY_PROMPT = `Você é um analisador de conversas de vendas.
Analise o histórico de conversa abaixo entre um lead e o bot de atendimento da Flowlinker (software de automação para redes sociais).

## OBJETIVO
Gerar um resumo conciso e útil da conversa para que a equipe de vendas entenda rapidamente:
1. O que foi discutido
2. Os pontos-chave da conversa
3. O sentimento geral do cliente

## HISTÓRICO DA CONVERSA
{conversationHistory}

## FORMATO DE RESPOSTA (JSON)
{
  "summary": "Resumo de 2-3 frases do que aconteceu na conversa, incluindo estágio atual e próximos passos se houver",
  "keyPoints": ["ponto 1", "ponto 2", "ponto 3"],
  "sentiment": "positivo" | "neutro" | "negativo"
}

Regras para keyPoints:
- Liste os principais pontos discutidos (cidade, segmento, objeções, interesse demonstrado)
- Máximo 5 pontos
- Seja objetivo e conciso

Regras para sentiment:
- positivo: Cliente demonstrou interesse, foi receptivo, agendou reunião
- neutro: Cliente foi indiferente, parou de responder sem motivo claro
- negativo: Cliente demonstrou desinteresse, levantou objeções fortes, pediu para não ser contactado

Responda APENAS com o JSON, sem markdown ou texto adicional.`;

/**
 * Calcula hash SHA-256 das mensagens
 */
function computeMessagesHash(messages: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(messages)).digest("hex");
}

/**
 * Verifica se deve regenerar o resumo
 */
async function shouldRegenerateSummary(
  conversationLogId: string,
  currentMessages: unknown[]
): Promise<boolean> {
  const existing = await prisma.conversationSummary.findUnique({
    where: { conversationLogId },
    select: { messageCount: true, messagesHash: true },
  });

  // Não existe cache
  if (!existing) return true;

  // Quick check: quantidade de mensagens mudou
  if (currentMessages.length !== existing.messageCount) return true;

  // Full check: hash das mensagens mudou
  const currentHash = computeMessagesHash(currentMessages);
  return currentHash !== existing.messagesHash;
}

/**
 * Gera resumo usando IA
 */
async function generateSummaryWithAI(
  messages: Array<{ role: string; content: string }>
): Promise<{ summary: string; keyPoints: string[]; sentiment: string }> {
  const historyText = messages
    .map((m) => `${m.role === "user" ? "Lead" : "Bot"}: ${m.content}`)
    .join("\n");

  const prompt = SUMMARY_PROMPT.replace("{conversationHistory}", historyText);

  const response = await summaryModel.invoke(prompt);
  const content =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  // Remove possíveis backticks de markdown
  const cleanJson = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  return JSON.parse(cleanJson);
}

/**
 * Gera ou retorna resumo cacheado de uma conversa
 */
export async function generateOrGetSummary(
  conversationLogId: string
): Promise<ConversationSummaryResult | null> {
  // Busca a conversa
  const log = await prisma.conversationLog.findUnique({
    where: { id: conversationLogId },
    include: { summary: true },
  });

  if (!log) {
    return null;
  }

  const messages =
    (log.messages as Array<{ role: string; content: string }>) || [];

  if (messages.length === 0) {
    return {
      summary: "Sem mensagens na conversa",
      keyPoints: [],
      sentiment: "neutro",
      isCached: false,
    };
  }

  // Verifica se precisa regenerar
  const needsRegeneration = await shouldRegenerateSummary(
    conversationLogId,
    messages
  );

  if (!needsRegeneration && log.summary) {
    // Retorna do cache
    return {
      summary: log.summary.summary,
      keyPoints: (log.summary.keyPoints as string[]) || [],
      sentiment: (log.summary.sentiment as "positivo" | "neutro" | "negativo") || "neutro",
      isCached: true,
    };
  }

  // Gera novo resumo
  try {
    const aiResult = await generateSummaryWithAI(messages);
    const messagesHash = computeMessagesHash(messages);

    // Salva no banco (upsert)
    await prisma.conversationSummary.upsert({
      where: { conversationLogId },
      create: {
        conversationLogId,
        summary: aiResult.summary,
        keyPoints: aiResult.keyPoints,
        sentiment: aiResult.sentiment,
        messagesHash,
        messageCount: messages.length,
        generatedAt: new Date(),
      },
      update: {
        summary: aiResult.summary,
        keyPoints: aiResult.keyPoints,
        sentiment: aiResult.sentiment,
        messagesHash,
        messageCount: messages.length,
        generatedAt: new Date(),
      },
    });

    return {
      summary: aiResult.summary,
      keyPoints: aiResult.keyPoints,
      sentiment: aiResult.sentiment as "positivo" | "neutro" | "negativo",
      isCached: false,
    };
  } catch (error) {
    console.error(
      `[SummaryGenerator] Erro ao gerar resumo para ${conversationLogId}:`,
      error
    );
    return null;
  }
}

/**
 * Gera resumo por telefone
 */
export async function generateOrGetSummaryByPhone(
  phone: string
): Promise<ConversationSummaryResult | null> {
  const log = await prisma.conversationLog.findUnique({
    where: { phone },
    select: { id: true },
  });

  if (!log) {
    return null;
  }

  return generateOrGetSummary(log.id);
}

/**
 * Força regeneração do resumo (ignora cache)
 */
export async function forceRegenerateSummary(
  conversationLogId: string
): Promise<ConversationSummaryResult | null> {
  // Deleta cache existente
  await prisma.conversationSummary
    .delete({
      where: { conversationLogId },
    })
    .catch(() => {
      // Ignora erro se não existir
    });

  return generateOrGetSummary(conversationLogId);
}

/**
 * Busca conversas sem resumo
 */
export async function findConversationsWithoutSummary(
  limit: number = 50
): Promise<Array<{ id: string; phone: string; messageCount: number }>> {
  const conversations = await prisma.conversationLog.findMany({
    where: {
      summary: null,
    },
    select: {
      id: true,
      phone: true,
      messages: true,
    },
    orderBy: { lastContactAt: "desc" },
    take: limit,
  });

  return conversations.map((c) => ({
    id: c.id,
    phone: c.phone,
    messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
  }));
}

/**
 * Gera resumos em lote para conversas sem cache
 */
export async function generateSummariesBatch(
  limit: number = 10,
  delayMs: number = 1000
): Promise<{ processed: number; success: number; failed: number }> {
  const conversations = await findConversationsWithoutSummary(limit);

  let success = 0;
  let failed = 0;

  for (const conv of conversations) {
    try {
      console.log(
        `[SummaryGenerator] Processando ${conv.phone} (${conv.messageCount} mensagens)...`
      );

      const result = await generateOrGetSummary(conv.id);

      if (result) {
        success++;
        console.log(`[SummaryGenerator] Resumo gerado para ${conv.phone}`);
      } else {
        failed++;
        console.log(`[SummaryGenerator] Falha ao gerar resumo para ${conv.phone}`);
      }

      // Delay entre requisições para evitar rate limit
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      failed++;
      console.error(
        `[SummaryGenerator] Erro ao processar ${conv.phone}:`,
        error
      );
    }
  }

  return {
    processed: conversations.length,
    success,
    failed,
  };
}
