import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as meetingService from "../../services/meeting.js";
import * as evolutionService from "../../services/evolution.js";
import { createBrasiliaDate } from "../../services/calendar.js";

export const rescheduleMeetingTool = tool(
  async ({ oldMeetingId, date, startTime }) => {
    try {
      const [year, month, day] = date.split("-").map(Number);
      const [startHour, startMin] = startTime.split(":").map(Number);

      // Cria a data no horário de Brasília (independente do timezone do servidor)
      const start = createBrasiliaDate(year, month, day, startHour, startMin);

      if (start < new Date()) {
        return JSON.stringify({
          success: false,
          error:
            "O horario solicitado ja passou. Por favor, escolha um horario futuro.",
        });
      }

      const result = await meetingService.rescheduleMeeting({
        oldMeetingId,
        newStartTime: start,
      });

      if (!result.success) {
        return JSON.stringify({ success: false, error: result.error });
      }

      const newMeeting = result.newMeeting;

      // Notifica vendedor imediatamente (se tiver phone cadastrado e link)
      if (newMeeting.success && newMeeting.meetLink && newMeeting.sellerPhone) {
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        const sellerMsg =
          `🔁 Reuniao remarcada\n\n` +
          `Data: ${start.toLocaleDateString("pt-BR")}\n` +
          `Horario: ${start.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })} - ` +
          `${end.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}\n` +
          `\nLink: ${newMeeting.meetLink}`;

        await evolutionService.sendText(newMeeting.sellerPhone, sellerMsg);
      }

      const formattedDate = start.toLocaleDateString("pt-BR");
      const formattedStart = start.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const formattedEnd = new Date(
        start.getTime() + 30 * 60 * 1000
      ).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      return JSON.stringify({
        success: true,
        message:
          `Reuniao remarcada com sucesso!\n\n` +
          `Vendedor: ${newMeeting.sellerName}\n` +
          `Data: ${formattedDate}\n` +
          `Horario: ${formattedStart} - ${formattedEnd}\n` +
          (newMeeting.meetLink
            ? `\nLink da reuniao: ${newMeeting.meetLink}\n`
            : "") +
          `\nObs: para remarcar, o sistema cria uma nova reuniao e cancela a anterior.`,
        newMeetingId: newMeeting.meetingId,
        oldMeetingId,
        meetLink: newMeeting.meetLink,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Erro ao remarcar reuniao: ${error.message}`,
      });
    }
  },
  {
    name: "reschedule_meeting",
    description:
      "Remarca uma reuniao existente. IMPORTANTE: na pratica cria uma nova reuniao (30min) e cancela a anterior.",
    schema: z.object({
      oldMeetingId: z
        .string()
        .describe("ID da reuniao antiga (fornecido por get_meetings)"),
      date: z.string().describe("Nova data no formato YYYY-MM-DD"),
      startTime: z
        .string()
        .describe(
          "Novo horario de inicio no formato HH:MM (duracao fixa 30min)"
        ),
    }),
  }
);
