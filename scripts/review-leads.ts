/**
 * Script interativo para revisar e corrigir status dos leads
 *
 * Mostra cada conversa, a análise do GPT, e permite aprovar ou recusar a sugestão.
 *
 * Uso:
 *   npx tsx scripts/review-leads.ts
 */

import "dotenv/config";
import * as readline from "readline";
import { ChatOpenAI } from "@langchain/openai";
import { prisma } from "../src/database/client.js";
import { env } from "../src/config/env.js";

// Modelo para análise
const analyzerModel = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
  apiKey: env.openaiApiKey,
});

// Interface para input do usuário
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

// Prompt para análise de status
const STATUS_ANALYSIS_PROMPT = `Analise esta conversa de um lead com o bot da Flowlinker e determine o STATUS correto.

## CONTEXTO
A Flowlinker é um software de automação para redes sociais. O bot qualifica leads e agenda reuniões de demonstração.

## STATUS POSSÍVEIS
- ACTIVE: Conversa ativa, lead ainda pode responder
- INACTIVE: Lead parou de responder há tempo
- REACTIVATING: Em processo de reativação (já recebeu mensagem de follow-up)
- CONVERTED: Lead agendou reunião (SUCESSO!)
- DISCARDED: Lead sem interesse, número inválido, ou descartado por outro motivo

## DADOS DO LEAD
Telefone: {phone}
Última interação: {lastContactAt}
Tem reunião agendada: {hasMeeting}
Bot desabilitado (transferido p/ humano): {disabled}
Tentativas de reativação: {reactivationAttempts}
Status atual no banco: {currentStatus}

## HISTÓRICO DA CONVERSA
{conversation}

## ANÁLISE
Com base na conversa e nos dados, determine:
1. Qual o STATUS correto para este lead?
2. Qual o estágio da conversa? (greeting, city_collected, segment_collected, scheduling, meeting_scheduled, objection, etc.)
3. Breve justificativa (1 linha)

IMPORTANTE:
- Se TEM REUNIÃO AGENDADA → status deve ser CONVERTED
- Se foi TRANSFERIDO PARA HUMANO (disabled=true) → não alterar, deixar como está
- Se a conversa mostra DESINTERESSE explícito → DISCARDED
- Se apenas parou de responder → INACTIVE ou ACTIVE dependendo do tempo

Responda em JSON:
{
  "suggestedStatus": "STATUS_AQUI",
  "stage": "estagio_aqui",
  "reason": "justificativa aqui"
}`;

interface LeadAnalysis {
  suggestedStatus: string;
  stage: string;
  reason: string;
}

async function analyzeLeadStatus(
  phone: string,
  conversation: string,
  lastContactAt: Date,
  hasMeeting: boolean,
  disabled: boolean,
  reactivationAttempts: number,
  currentStatus: string
): Promise<LeadAnalysis> {
  const prompt = STATUS_ANALYSIS_PROMPT
    .replace("{phone}", phone)
    .replace("{lastContactAt}", lastContactAt.toLocaleString("pt-BR"))
    .replace("{hasMeeting}", hasMeeting ? "SIM" : "NÃO")
    .replace("{disabled}", disabled ? "SIM" : "NÃO")
    .replace("{reactivationAttempts}", reactivationAttempts.toString())
    .replace("{currentStatus}", currentStatus)
    .replace("{conversation}", conversation);

  try {
    const response = await analyzerModel.invoke(prompt);
    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    const cleanJson = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    return JSON.parse(cleanJson) as LeadAnalysis;
  } catch (error) {
    return {
      suggestedStatus: currentStatus,
      stage: "unknown",
      reason: "Erro na análise",
    };
  }
}

function formatConversation(messages: Array<{ role: string; content: string }>): string {
  return messages
    .map((m) => {
      const role = m.role === "user" ? "👤 Lead" : "🤖 Bot";
      const content = m.content.length > 200 ? m.content.substring(0, 200) + "..." : m.content;
      return `${role}: ${content}`;
    })
    .join("\n");
}

async function main() {
  console.log("=".repeat(70));
  console.log("REVISÃO DE STATUS DOS LEADS");
  console.log("=".repeat(70));
  console.log("\nBuscando leads do banco...\n");

  // Busca todos os leads
  const leads = await prisma.conversationLog.findMany({
    orderBy: { lastContactAt: "desc" },
  });

  // Busca reuniões agendadas
  const meetings = await prisma.meeting.findMany({
    where: {
      status: "SCHEDULED",
      startTime: { gte: new Date() },
    },
    select: { clientPhone: true },
  });
  const phonesWithMeetings = new Set(meetings.map((m) => m.clientPhone));

  console.log(`Total de leads: ${leads.length}`);
  console.log(`Leads com reunião agendada: ${phonesWithMeetings.size}`);
  console.log("\n" + "-".repeat(70) + "\n");

  let updated = 0;
  let skipped = 0;
  let reviewed = 0;

  for (const lead of leads) {
    reviewed++;
    const hasMeeting = phonesWithMeetings.has(lead.phone);
    const messages = (lead.messages as Array<{ role: string; content: string }>) || [];

    if (messages.length === 0) {
      console.log(`[${reviewed}/${leads.length}] ${lead.phone}: Sem histórico, pulando...\n`);
      skipped++;
      continue;
    }

    console.log("=".repeat(70));
    console.log(`LEAD ${reviewed}/${leads.length}`);
    console.log("=".repeat(70));
    console.log(`📱 Telefone: ${lead.phone}`);
    console.log(`📅 Última interação: ${lead.lastContactAt.toLocaleString("pt-BR")}`);
    console.log(`📊 Status atual: ${lead.conversationStatus}`);
    console.log(`🔄 Tentativas de reativação: ${lead.reactivationAttempts}`);
    console.log(`📆 Tem reunião agendada: ${hasMeeting ? "SIM ✅" : "NÃO"}`);
    console.log(`🚫 Bot desabilitado: ${lead.disabled ? "SIM" : "NÃO"}`);
    console.log("\n--- CONVERSA ---\n");
    console.log(formatConversation(messages));
    console.log("\n--- ANALISANDO COM IA... ---\n");

    const analysis = await analyzeLeadStatus(
      lead.phone,
      formatConversation(messages),
      lead.lastContactAt,
      hasMeeting,
      lead.disabled,
      lead.reactivationAttempts,
      lead.conversationStatus
    );

    console.log(`🤖 SUGESTÃO DA IA:`);
    console.log(`   Status: ${lead.conversationStatus} → ${analysis.suggestedStatus}`);
    console.log(`   Estágio: ${analysis.stage}`);
    console.log(`   Motivo: ${analysis.reason}`);

    const statusChanged = analysis.suggestedStatus !== lead.conversationStatus;
    const stageChanged = analysis.stage !== lead.stage;

    if (!statusChanged && !stageChanged) {
      console.log("\n✅ Status já está correto, pulando...\n");
      skipped++;
      continue;
    }

    console.log("\n" + "-".repeat(40));
    const answer = await ask(
      `\n[S]im para APROVAR | [N]ão para RECUSAR | [P]ular este | [Q]uit para sair: `
    );

    if (answer === "q" || answer === "quit") {
      console.log("\nEncerrando revisão...");
      break;
    }

    if (answer === "p" || answer === "pular") {
      console.log("Pulado.\n");
      skipped++;
      continue;
    }

    if (answer === "s" || answer === "sim" || answer === "y" || answer === "yes") {
      // Atualiza no banco
      await prisma.conversationLog.update({
        where: { id: lead.id },
        data: {
          conversationStatus: analysis.suggestedStatus as any,
          stage: analysis.stage,
        },
      });
      console.log(`\n✅ Atualizado: ${lead.conversationStatus} → ${analysis.suggestedStatus}\n`);
      updated++;
    } else {
      console.log("Não atualizado.\n");
      skipped++;
    }
  }

  rl.close();

  console.log("\n" + "=".repeat(70));
  console.log("RESUMO DA REVISÃO");
  console.log("=".repeat(70));
  console.log(`Total revisado: ${reviewed}`);
  console.log(`Atualizados: ${updated}`);
  console.log(`Pulados/Recusados: ${skipped}`);
  console.log("=".repeat(70));

  process.exit(0);
}

main().catch((error) => {
  console.error("Erro:", error);
  rl.close();
  process.exit(1);
});
