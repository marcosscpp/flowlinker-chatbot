import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as meetingService from "../../services/meeting.js";
import * as evolutionService from "../../services/evolution.js";
import { prisma } from "../../database/client.js";

export const createMeetingTool = tool(
  async ({
    date,
    startTime,
    clientName,
    clientEmail,
    subject,
    clientPhone,
    clientCity,
    clientState,
    clientCityPopulation,
    clientSegment,
    observations,
  }) => {
    try {
      // Parseia data e horarios
      const [year, month, day] = date.split("-").map(Number);
      const [startHour, startMin] = startTime.split(":").map(Number);

      const start = new Date(year, month - 1, day, startHour, startMin);
      // Duracao padrao: 30 minutos
      const end = new Date(start.getTime() + 30 * 60 * 1000);

      // Valida se a data e no futuro
      if (start < new Date()) {
        return JSON.stringify({
          success: false,
          error:
            "O horario solicitado ja passou. Por favor, escolha um horario futuro.",
        });
      }

      // ANTI-DUPLICATA: Verifica se já existe reunião para este telefone neste horário
      const existingMeeting = await prisma.meeting.findFirst({
        where: {
          clientPhone,
          startTime: start,
          status: "SCHEDULED",
        },
        include: { seller: true },
      });

      if (existingMeeting) {
        // Já existe reunião - retorna os dados dela em vez de criar duplicata
        const formattedDate = start.toLocaleDateString("pt-BR");
        const formattedStart = start.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const formattedEnd = end.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        console.log("existingMeeting", existingMeeting);

        return JSON.stringify({
          success: true,
          message:
            `Informações da reunião:\n\n` +
            `Vendedor: ${existingMeeting.seller.name}\n` +
            `Data: ${formattedDate}\n` +
            `Horario: ${formattedStart} - ${formattedEnd}\n` +
            (existingMeeting.meetLink
              ? `\nLink da reuniao: ${existingMeeting.meetLink}\n`
              : ""),
          meetingId: existingMeeting.id,
          sellerName: existingMeeting.seller.name,
          sellerEmail: existingMeeting.seller.email,
          meetLink: existingMeeting.meetLink,
        });
      }

      const result = await meetingService.scheduleMeeting({
        clientPhone,
        clientName,
        clientEmail,
        subject,
        startTime: start,
        endTime: end,
        clientCity,
        clientState,
        clientCityPopulation,
        clientSegment,
        observations,
      });

      if (!result.success) {
        return JSON.stringify({
          success: false,
          error: result.error,
        });
      }

      // Notifica imediatamente (cliente recebe via worker; vendedor recebe aqui)
      // OBS: vendedor precisa ter phone cadastrado no banco para receber WhatsApp.
      const meetLink = result.meetLink || null;
      if (meetLink && result.sellerPhone) {
        const sellerMsg =
          `✅ Nova reuniao agendada (TESTE)\n\n` +
          `Cliente: ${clientName || clientPhone}\n` +
          (clientEmail ? `Email: ${clientEmail}\n` : "") +
          `Data: ${start.toLocaleDateString("pt-BR")}\n` +
          `Horario: ${start.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })} - ` +
          `${end.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}\n` +
          (subject ? `Assunto: ${subject}\n` : "") +
          `\nLink: ${meetLink}`;

        await evolutionService.sendText(result.sellerPhone, sellerMsg);
      }

      const formattedDate = start.toLocaleDateString("pt-BR");
      const formattedStart = start.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const formattedEnd = end.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      return JSON.stringify({
        success: true,
        message:
          `Reuniao agendada com sucesso!\n\n` +
          `Vendedor: ${result.sellerName}\n` +
          `Data: ${formattedDate}\n` +
          `Horario: ${formattedStart} - ${formattedEnd}\n` +
          (subject ? `Assunto: ${subject}\n` : "") +
          (result.meetLink ? `\nLink da reuniao: ${result.meetLink}\n` : "") +
          (result.reminderAt
            ? `\nLembrete programado para: ${result.reminderAt.toLocaleString(
                "pt-BR"
              )}\n`
            : ""),
        meetingId: result.meetingId,
        sellerName: result.sellerName,
        sellerEmail: result.sellerEmail,
        meetLink: result.meetLink,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Erro ao criar reuniao: ${error.message}`,
      });
    }
  },
  {
    name: "create_meeting",
    description:
      "Cria uma nova reuniao com um vendedor disponivel. " +
      "IMPORTANTE: Sempre verifique a disponibilidade com check_availability antes de criar a reuniao. " +
      "O sistema selecionara automaticamente um vendedor disponivel.",
    schema: z.object({
      date: z
        .string()
        .describe(
          "Data da reuniao no formato YYYY-MM-DD (exemplo: 2026-01-15)"
        ),
      startTime: z
        .string()
        .describe("Horario de inicio no formato HH:MM (exemplo: 14:30)"),
      clientPhone: z
        .string()
        .describe("Numero de telefone do cliente (fornecido pelo sistema)"),
      clientName: z
        .string()
        .nullable()
        .optional()
        .describe("Nome do cliente (se informado)"),
      clientEmail: z
        .string()
        .nullable()
        .optional()
        .describe("Email do cliente (se informado)"),
      subject: z
        .string()
        .nullable()
        .optional()
        .describe("Assunto da reuniao (se informado)"),
      clientCity: z
        .string()
        .nullable()
        .optional()
        .describe("Cidade do cliente (ex: Londrina)"),
      clientState: z
        .string()
        .nullable()
        .optional()
        .describe("Estado do cliente - sigla com 2 letras (ex: PR, SP)"),
      clientCityPopulation: z
        .number()
        .nullable()
        .optional()
        .describe("Populacao da cidade do cliente (numero de habitantes)"),
      clientSegment: z
        .string()
        .nullable()
        .optional()
        .describe("Segmento do cliente: negocios, pessoal ou politico"),
      observations: z
        .string()
        .nullable()
        .optional()
        .describe(
          "Observacoes ou detalhes adicionais mencionados pelo cliente durante a conversa"
        ),
    }),
  }
);
