import { ChatOpenAI } from "@langchain/openai";
import { env } from "../config/env.js";
import { prisma } from "../database/client.js";
import type { ConversationStatus } from "@prisma/client";

// Modelo para análise (usa gpt-4o-mini para economia, é suficiente para classificação)
const analyzerModel = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
  apiKey: env.openaiApiKey,
});

/**
 * Estágios possíveis da conversa
 */
export type ConversationStage =
  | "greeting" // Só saudou, não informou cidade
  | "city_collected" // Informou cidade, não informou segmento
  | "segment_collected" // Informou segmento, não escolheu dia
  | "day_selected" // Escolheu dia, não escolheu horário
  | "scheduling" // Em processo de agendamento
  | "meeting_scheduled" // Reunião agendada
  | "meeting_cancelled" // Reunião foi cancelada
  | "objection" // Levantou objeção e não continuou
  | "transferred" // Transferido para humano
  | "unresponsive" // Parou de responder sem motivo claro
  | "unknown"; // Não conseguiu identificar

/**
 * Resultado da análise de conversa
 */
export interface ConversationAnalysis {
  stage: ConversationStage;
  shouldReactivate: boolean;
  reactivationMessage: string | null;
  discardReason: string | null;
  summary: string;
}

/**
 * Prompt para análise de conversa
 */
const ANALYSIS_PROMPT = `Você é um analisador de conversas de vendas.
Analise o histórico de conversa abaixo entre um lead e o bot de atendimento da Flowlinker (software de automação para redes sociais).

## DATA ATUAL
Hoje é {currentDate}. Use esta informação para verificar se datas mencionadas na conversa já passaram.

## OBJETIVO
1. Identificar em qual ESTÁGIO a conversa parou
2. Decidir se devemos REATIVAR este contato
3. Gerar uma mensagem de reativação PERSONALIZADA (se aplicável)

## ESTÁGIOS POSSÍVEIS
- greeting: Lead só saudou, não informou cidade ainda
- city_collected: Informou cidade mas não o segmento (negócios/pessoal/político)
- segment_collected: Informou segmento mas não escolheu dia para reunião
- day_selected: Escolheu dia mas não o horário
- scheduling: Em processo ativo de agendamento
- meeting_scheduled: Já tem reunião agendada (NÃO REATIVAR)
- meeting_cancelled: Reunião foi cancelada
- objection: Levantou objeção (preço, tempo, etc) e parou
- transferred: Foi transferido para humano (NÃO REATIVAR)
- unresponsive: Parou de responder sem motivo aparente
- unknown: Não foi possível determinar

## REGRAS DE REATIVAÇÃO
REATIVAR se:
- greeting, city_collected, segment_collected, day_selected: Sim (conversa incompleta)
- objection: Sim (tentar contornar)
- unresponsive: Sim (reengajar)
- meeting_cancelled: Sim (tentar reagendar)

NÃO REATIVAR se:
- meeting_scheduled: Não (já tem reunião)
- transferred: Não (já está com humano)
- Cliente explicitamente disse que não tem interesse
- Cliente pediu para não ser mais contactado

## MENSAGEM DE REATIVAÇÃO
Se shouldReactivate = true, gere uma mensagem personalizada:
- Seja breve (1-2 frases)
- Retome de onde parou
- Não seja invasivo ou desesperado
- Use tom amigável e profissional
- NÃO use emojis
- Se foi objeção, não mencione diretamente a objeção
- IMPORTANTE: Se o lead escolheu uma data que JÁ PASSOU (anterior a {currentDate}), NÃO mencione essa data. Pergunte por uma nova data disponível.

Exemplos por estágio:
- greeting: "Oi! Vi que conversamos há alguns dias. Ainda posso te ajudar a conhecer a Flowlinker?"
- city_collected: "Oi [nome se tiver]! Você me passou sua cidade mas não conseguimos finalizar. Ainda quer saber das vagas disponíveis na sua região?"
- segment_collected: "Oi! Lembro que você se interessou pela Flowlinker para [segmento]. Posso verificar os horários disponíveis para sua demonstração?"
- day_selected (data futura): "Oi! Vi que você tinha escolhido o dia [dia] para sua demonstração mas não finalizamos. Ainda está disponível nessa data?"
- day_selected (data passada): "Oi! Vi que não conseguimos finalizar o agendamento da sua demonstração. Qual dia seria melhor para você esta semana?"
- objection: "Oi! Tudo bem? Só passando para ver se surgiu alguma dúvida sobre a Flowlinker. Estou à disposição!"
- meeting_cancelled: "Oi! Vi que sua reunião foi cancelada. Gostaria de reagendar para outra data?"
- unresponsive: "Oi! Passando para ver se ainda tem interesse em conhecer a Flowlinker. Posso te ajudar com alguma dúvida?"

## HISTÓRICO DA CONVERSA
Tentativa de reativação atual: {attemptNumber} de 3 máximo
{conversationHistory}

## FORMATO DE RESPOSTA (JSON)
{
  "stage": "nome_do_estagio",
  "shouldReactivate": true/false,
  "reactivationMessage": "mensagem ou null",
  "discardReason": "motivo do descarte se shouldReactivate=false, ou null",
  "summary": "resumo de 1 linha do que aconteceu na conversa"
}

Responda APENAS com o JSON, sem markdown ou texto adicional.`;

/**
 * Analisa uma conversa para determinar se deve ser reativada
 */
export async function analyzeConversation(
  phone: string,
  attemptNumber: number = 1
): Promise<ConversationAnalysis> {
  // Busca o log da conversa
  const log = await prisma.conversationLog.findUnique({
    where: { phone },
  });

  if (!log) {
    return {
      stage: "unknown",
      shouldReactivate: false,
      reactivationMessage: null,
      discardReason: "Conversa não encontrada no banco de dados",
      summary: "Sem histórico",
    };
  }

  const messages = (log.messages as Array<{ role: string; content: string }>) || [];

  if (messages.length === 0) {
    return {
      stage: "unknown",
      shouldReactivate: false,
      reactivationMessage: null,
      discardReason: "Histórico de conversa vazio",
      summary: "Sem mensagens",
    };
  }

  // Verifica se já tem reunião agendada
  const hasMeeting = await prisma.meeting.findFirst({
    where: {
      clientPhone: phone,
      status: "SCHEDULED",
      startTime: { gte: new Date() },
    },
  });

  if (hasMeeting) {
    return {
      stage: "meeting_scheduled",
      shouldReactivate: false,
      reactivationMessage: null,
      discardReason: "Cliente já tem reunião agendada",
      summary: `Reunião agendada para ${hasMeeting.startTime.toLocaleDateString("pt-BR")}`,
    };
  }

  // Verifica se foi transferido para humano (bot desabilitado)
  if (log.disabled) {
    return {
      stage: "transferred",
      shouldReactivate: false,
      reactivationMessage: null,
      discardReason: "Cliente foi transferido para atendimento humano",
      summary: "Transferido para humano",
    };
  }

  // Formata histórico para análise
  const historyText = messages
    .map((m) => `${m.role === "user" ? "Lead" : "Bot"}: ${m.content}`)
    .join("\n");

  // Chama IA para análise
  const currentDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  const prompt = ANALYSIS_PROMPT
    .replace(/{currentDate}/g, currentDate)
    .replace("{attemptNumber}", attemptNumber.toString())
    .replace("{conversationHistory}", historyText);

  try {
    const response = await analyzerModel.invoke(prompt);
    const content = typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

    // Remove possíveis backticks de markdown
    const cleanJson = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const analysis = JSON.parse(cleanJson) as ConversationAnalysis;

    // Validações adicionais
    if (attemptNumber >= 3 && analysis.shouldReactivate) {
      return {
        ...analysis,
        shouldReactivate: false,
        reactivationMessage: null,
        discardReason: "Máximo de tentativas de reativação atingido (3)",
      };
    }

    return analysis;
  } catch (error) {
    console.error(`[ReactivationAnalyzer] Erro ao analisar conversa ${phone}:`, error);
    return {
      stage: "unknown",
      shouldReactivate: false,
      reactivationMessage: null,
      discardReason: "Erro na análise da conversa",
      summary: "Erro de análise",
    };
  }
}

/**
 * Busca contatos elegíveis para reativação
 */
export async function findContactsToReactivate(
  inactiveDays: number = 2,
  maxAttempts: number = 3,
  limit: number = 50
): Promise<Array<{
  id: string;
  phone: string;
  lastContactAt: Date;
  reactivationAttempts: number;
}>> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

  const contacts = await prisma.conversationLog.findMany({
    where: {
      // Última interação há mais de X dias
      lastContactAt: { lt: cutoffDate },
      // Status permite reativação
      conversationStatus: {
        in: ["ACTIVE", "INACTIVE", "REACTIVATING"],
      },
      // Não excedeu máximo de tentativas
      reactivationAttempts: { lt: maxAttempts },
      // Bot não está desabilitado (não foi transferido)
      disabled: false,
    },
    select: {
      id: true,
      phone: true,
      lastContactAt: true,
      reactivationAttempts: true,
    },
    orderBy: [
      // Prioriza quem tem menos tentativas
      { reactivationAttempts: "asc" },
      // Depois por data mais antiga
      { lastContactAt: "asc" },
    ],
    take: limit,
  });

  // Filtra contatos que já tem reunião agendada
  const phonesWithMeetings = await prisma.meeting.findMany({
    where: {
      clientPhone: { in: contacts.map((c) => c.phone) },
      status: "SCHEDULED",
      startTime: { gte: new Date() },
    },
    select: { clientPhone: true },
  });

  const phonesWithMeetingsSet = new Set(phonesWithMeetings.map((m) => m.clientPhone));

  return contacts.filter((c) => !phonesWithMeetingsSet.has(c.phone));
}

/**
 * Atualiza status da conversa após análise
 */
export async function updateConversationStatus(
  phone: string,
  stage: ConversationStage,
  status: ConversationStatus,
  discardReason?: string
): Promise<void> {
  await prisma.conversationLog.update({
    where: { phone },
    data: {
      stage,
      conversationStatus: status,
      discardReason: discardReason || null,
    },
  });
}

/**
 * Marca tentativa de reativação
 */
export async function markReactivationAttempt(phone: string): Promise<void> {
  await prisma.conversationLog.update({
    where: { phone },
    data: {
      reactivationAttempts: { increment: 1 },
      lastReactivationAt: new Date(),
      conversationStatus: "REACTIVATING",
    },
  });
}

/**
 * Marca contato como descartado
 */
export async function discardContact(
  phone: string,
  reason: string
): Promise<void> {
  await prisma.conversationLog.update({
    where: { phone },
    data: {
      conversationStatus: "DISCARDED",
      discardReason: reason,
    },
  });
}

/**
 * Marca contato como convertido (agendou reunião)
 */
export async function markAsConverted(phone: string): Promise<void> {
  await prisma.conversationLog.update({
    where: { phone },
    data: {
      conversationStatus: "CONVERTED",
      discardReason: null,
    },
  });
}
