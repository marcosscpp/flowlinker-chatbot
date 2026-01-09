import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as calendarService from "../../services/calendar.js";
import { createBrasiliaDate } from "../../services/calendar.js";

export const checkAvailabilityTool = tool(
  async ({ date, startTime }) => {
    try {
      // Parseia data e horarios
      const [year, month, day] = date.split("-").map(Number);
      const [startHour, startMin] = startTime.split(":").map(Number);

      // Cria a data no horário de Brasília (independente do timezone do servidor)
      const start = createBrasiliaDate(year, month, day, startHour, startMin);
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

      const result = await calendarService.checkAvailability(start, end);

      if (result.availableSellers.length === 0) {
        return JSON.stringify({
          success: true,
          available: false,
          message: `Nenhum consultor disponivel em ${date} as ${startTime} (duracao 30min).`,
        });
      }

      return JSON.stringify({
        success: true,
        available: true,
        message: `Temos disponibilidade em ${date} as ${startTime} (duracao 30min).`,
        availableCount: result.availableSellers.length,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Erro ao verificar disponibilidade: ${error.message}`,
      });
    }
  },
  {
    name: "check_availability",
    description:
      "Verifica se ha vendedores disponiveis em uma data e horario especificos. " +
      "Use esta ferramenta para verificar disponibilidade antes de agendar uma reuniao.",
    schema: z.object({
      date: z
        .string()
        .describe("Data no formato YYYY-MM-DD (exemplo: 2026-01-15)"),
      startTime: z
        .string()
        .describe("Horario de inicio no formato HH:MM (exemplo: 14:30)"),
    }),
  }
);
