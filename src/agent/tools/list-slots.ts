import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as calendarService from "../../services/calendar.js";
import { createBrasiliaDate } from "../../services/calendar.js";

export const listAvailableSlotsTool = tool(
  async ({ date, slotDuration }) => {
    try {
      // Parseia data e cria no horário de Brasília
      const [year, month, day] = date.split("-").map(Number);
      const targetDate = createBrasiliaDate(year, month, day, 12, 0); // Meio-dia para garantir o dia correto

      // Valida se a data e no futuro ou hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (targetDate < today) {
        return JSON.stringify({
          success: false,
          error:
            "A data solicitada ja passou. Por favor, escolha uma data atual ou futura.",
        });
      }

      const slots = await calendarService.listAvailableSlots(
        targetDate,
        slotDuration || 30
      );

      if (slots.length === 0) {
        return JSON.stringify({
          success: true,
          available: false,
          message: `Nenhum horario disponivel em ${date}.`,
          slots: [],
        });
      }

      // Formata os slots para exibicao
      const formattedSlots = slots.map((slot) => {
        const start = slot.start.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const end = slot.end.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return `${start} - ${end}`;
      });

      console.log("formattedSlots", formattedSlots);

      return JSON.stringify({
        success: true,
        available: true,
        message: `Horarios disponiveis em ${date}:`,
        slots: formattedSlots,
        totalSlots: slots.length,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Erro ao listar horarios: ${error.message}`,
      });
    }
  },
  {
    name: "list_available_slots",
    description:
      "Lista todos os horarios disponiveis em uma data especifica. " +
      "Use quando o cliente quiser saber quais horarios estao livres. " +
      "Retorna slots onde pelo menos 1 vendedor esta disponivel.",
    schema: z.object({
      date: z
        .string()
        .describe(
          "Data para listar horarios no formato YYYY-MM-DD (exemplo: 2026-01-15)"
        ),
      slotDuration: z
        .number()
        .nullable()
        .optional()
        .describe("Duracao de cada slot em minutos (padrao: 30)"),
    }),
  }
);
