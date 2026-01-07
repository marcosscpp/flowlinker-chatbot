import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as meetingService from "../../services/meeting.js";

export const getMeetingsTool = tool(
  async ({ clientPhone }) => {
    try {
      const meetings = await meetingService.getMeetingsByPhone(clientPhone);

      if (meetings.length === 0) {
        return JSON.stringify({
          success: true,
          hasMeetings: false,
          message: "Voce nao possui reunioes agendadas.",
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
          meetLink: (meeting as any).meetLink || null,
        };
      });

      const meetingsList = formattedMeetings
        .map(
          (m, i) =>
            `${i + 1}. ${m.date} as ${m.time} com ${m.seller}` +
            (m.subject !== "Nao informado" ? ` - ${m.subject}` : "") +
            (m.meetLink ? `\n   Link: ${m.meetLink}` : "")
        )
        .join("\n");

      return JSON.stringify({
        success: true,
        hasMeetings: true,
        message: `Suas reunioes agendadas:\n\n${meetingsList}`,
        meetings: formattedMeetings,
        totalMeetings: meetings.length,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Erro ao buscar reunioes: ${error.message}`,
      });
    }
  },
  {
    name: "get_meetings",
    description:
      "Busca as reunioes agendadas de um cliente pelo numero de telefone. " +
      "Use quando o cliente quiser ver suas reunioes marcadas.",
    schema: z.object({
      clientPhone: z
        .string()
        .describe("Numero de telefone do cliente (fornecido pelo sistema)"),
    }),
  }
);
