import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as meetingService from "../../services/meeting.js";

export const getMeetingsByEmailTool = tool(
  async ({ clientEmail }) => {
    try {
      const email = clientEmail.trim().toLowerCase();
      const meetings = await meetingService.getMeetingsByEmail(email);

      if (meetings.length === 0) {
        return JSON.stringify({
          success: true,
          hasMeetings: false,
          message: "Nao encontrei reunioes agendadas para este email.",
          meetings: [],
        });
      }

      const formattedMeetings = meetings.map((meeting) => {
        const date = meeting.startTime.toLocaleDateString("pt-BR");
        const start = meeting.startTime.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const end = meeting.endTime.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        return {
          id: meeting.id,
          date,
          time: `${start} - ${end}`,
          seller: meeting.seller.name,
          subject: meeting.subject || "Nao informado",
          meetLink: meeting.meetLink || null,
        };
      });

      const meetingsList = formattedMeetings
        .map(
          (m, i) =>
            `${i + 1}. ${m.date} as ${m.time} com ${m.seller}` +
            (m.meetLink ? `\n   Link: ${m.meetLink}` : "") +
            (m.subject !== "Nao informado" ? `\n   Assunto: ${m.subject}` : "")
        )
        .join("\n");

      return JSON.stringify({
        success: true,
        hasMeetings: true,
        message: `Encontrei reunioes para este email:\n\n${meetingsList}`,
        meetings: formattedMeetings,
        totalMeetings: meetings.length,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Erro ao buscar reunioes por email: ${error.message}`,
      });
    }
  },
  {
    name: "get_meetings_by_email",
    description:
      "Busca reunioes agendadas (futuras) pelo email do cliente. " +
      "Use para evitar criar reunioes duplicadas para o mesmo email.",
    schema: z.object({
      clientEmail: z.string().describe("Email do cliente"),
    }),
  }
);
