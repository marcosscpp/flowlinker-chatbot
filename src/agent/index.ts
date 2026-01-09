import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { env } from "../config/env.js";
import { prisma } from "../database/client.js";
import type { Prisma } from "@prisma/client";
import { buildSystemPrompt } from "./prompts/system.js";
import {
  checkAvailabilityTool,
  createMeetingTool,
  listAvailableSlotsTool,
  listAvailableDaysTool,
  getMeetingsTool,
  getMeetingsByEmailTool,
  rescheduleMeetingTool,
  getCityPopulationTool,
} from "./tools/index.js";

// Configura o modelo
const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.3,
  apiKey: env.openaiApiKey,
});

// Define as ferramentas
const tools = [
  checkAvailabilityTool,
  createMeetingTool,
  listAvailableSlotsTool,
  listAvailableDaysTool,
  getMeetingsTool,
  getMeetingsByEmailTool,
  rescheduleMeetingTool,
  getCityPopulationTool,
];

// Cria o agente
const agent = createReactAgent({
  llm: model,
  tools,
});

interface MessageHistory {
  role: "user" | "assistant";
  content: string;
}

/**
 * Carrega historico de conversa do banco
 */
async function loadConversationHistory(
  phone: string
): Promise<MessageHistory[]> {
  const log = await prisma.conversationLog.findUnique({
    where: { phone },
  });

  if (!log) return [];

  return (log.messages as unknown as MessageHistory[]) || [];
}

/**
 * Salva historico de conversa no banco
 */
async function saveConversationHistory(
  phone: string,
  history: MessageHistory[]
): Promise<void> {
  // Limita o historico a 20 mensagens para nao estourar contexto
  const limitedHistory = history.slice(-20);
  const now = new Date();

  await prisma.conversationLog.upsert({
    where: { phone },
    create: {
      phone,
      messages: limitedHistory as unknown as Prisma.InputJsonValue,
      lastContactAt: now,
    } as any,
    update: {
      messages: limitedHistory as unknown as Prisma.InputJsonValue,
      lastContactAt: now,
    } as any,
  });
}

/**
 * Converte historico para formato LangChain
 */
function historyToMessages(history: MessageHistory[]): BaseMessage[] {
  return history.map((msg) =>
    msg.role === "user"
      ? new HumanMessage(msg.content)
      : new AIMessage(msg.content)
  );
}

/**
 * Processa mensagem do usuario e retorna resposta do agente
 */
export async function processMessage(
  phone: string,
  text: string,
  name?: string
): Promise<string> {
  try {
    // Carrega historico
    const history = await loadConversationHistory(phone);

    // Adiciona mensagem do usuario ao historico
    history.push({ role: "user", content: text });

    // Constroi mensagens para o agente
    const messages = historyToMessages(history);

    // Executa o agente com o system prompt
    const systemPrompt = buildSystemPrompt(phone, name);

    const result = await agent.invoke({
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    });

    // Extrai a resposta do agente
    const lastMessage = result.messages[result.messages.length - 1];
    const response =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    // Adiciona resposta ao historico
    history.push({ role: "assistant", content: response });

    // Salva historico atualizado
    await saveConversationHistory(phone, history);

    return response;
  } catch (error: any) {
    console.error("Erro ao processar mensagem:", error);

    // Retorna mensagem de erro amigavel
    return (
      "Desculpe, ocorreu um erro ao processar sua mensagem. " +
      "Por favor, tente novamente em alguns instantes."
    );
  }
}

/**
 * Limpa historico de conversa
 */
export async function clearHistory(phone: string): Promise<void> {
  await prisma.conversationLog
    .delete({
      where: { phone },
    })
    .catch(() => {});
}
