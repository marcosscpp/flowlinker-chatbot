/**
 * Script automático para classificar e corrigir status dos leads
 *
 * Analisa todos os leads com IA e atualiza automaticamente no banco.
 *
 * Uso:
 *   npx tsx scripts/review-leads.ts
 */

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { prisma } from "../src/database/client.js";
import { env } from "../src/config/env.js";

// Modelo para análise
const analyzerModel = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
  apiKey: env.openaiApiKey,
});

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
      const role = m.role === "user" ? "Lead" : "Bot";
      const content = m.content.length > 300 ? m.content.substring(0, 300) + "..." : m.content;
      return `${role}: ${content}`;
    })
    .join("\n");
}

async function main() {
  console.log("=".repeat(70));
  console.log("CLASSIFICAÇÃO AUTOMÁTICA DE LEADS");
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
  console.log(`Leads com reunião agendada: ${phonesWithMeetings.size}\n`);

  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let errors = 0;

  const changes: Array<{
    phone: string;
    oldStatus: string;
    newStatus: string;
    stage: string;
    reason: string;
  }> = [];

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const hasMeeting = phonesWithMeetings.has(lead.phone);
    const messages = (lead.messages as Array<{ role: string; content: string }>) || [];

    process.stdout.write(`\r[${i + 1}/${leads.length}] Analisando ${lead.phone}...`);

    if (messages.length === 0) {
      skipped++;
      continue;
    }

    try {
      const analysis = await analyzeLeadStatus(
        lead.phone,
        formatConversation(messages),
        lead.lastContactAt,
        hasMeeting,
        lead.disabled,
        lead.reactivationAttempts,
        lead.conversationStatus
      );

      const statusChanged = analysis.suggestedStatus !== lead.conversationStatus;
      const stageChanged = analysis.stage !== lead.stage;

      if (statusChanged || stageChanged) {
        // Atualiza no banco
        await prisma.conversationLog.update({
          where: { id: lead.id },
          data: {
            conversationStatus: analysis.suggestedStatus as any,
            stage: analysis.stage,
          },
        });

        changes.push({
          phone: lead.phone,
          oldStatus: lead.conversationStatus,
          newStatus: analysis.suggestedStatus,
          stage: analysis.stage,
          reason: analysis.reason,
        });

        updated++;
      } else {
        unchanged++;
      }
    } catch (error) {
      errors++;
    }
  }

  // Limpa a linha de progresso
  console.log("\r" + " ".repeat(60) + "\r");

  // Resumo
  console.log("=".repeat(70));
  console.log("RESUMO DA CLASSIFICAÇÃO");
  console.log("=".repeat(70));
  console.log(`✅ Atualizados: ${updated}`);
  console.log(`⏸️  Sem alteração: ${unchanged}`);
  console.log(`⏭️  Pulados (sem histórico): ${skipped}`);
  console.log(`❌ Erros: ${errors}`);
  console.log("");

  if (changes.length > 0) {
    console.log("=".repeat(70));
    console.log("ALTERAÇÕES REALIZADAS");
    console.log("=".repeat(70));

    for (const change of changes) {
      console.log(`\n📱 ${change.phone}`);
      console.log(`   ${change.oldStatus} → ${change.newStatus}`);
      console.log(`   Estágio: ${change.stage}`);
      console.log(`   Motivo: ${change.reason}`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("CLASSIFICAÇÃO FINALIZADA");
  console.log("=".repeat(70));

  process.exit(0);
}

main().catch((error) => {
  console.error("Erro:", error);
  process.exit(1);
});
