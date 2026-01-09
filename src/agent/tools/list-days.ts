import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as calendarService from "../../services/calendar.js";

const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

export const listAvailableDaysTool = tool(
  async ({ numberOfDays }) => {
    try {
      const days: Array<{
        date: string;
        dateFormatted: string;
        weekday: string;
        isToday: boolean;
        hasAvailability: boolean;
        availableSlots: number;
      }> = [];

      // Pega a data/hora atual em São Paulo
      const now = new Date(
        new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
      );
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Se já passou das 18:00, não inclui hoje (última reunião começa às 18:00)
      const todayIsAvailable = currentHour < 18;

      let currentDate = new Date(now);
      currentDate.setHours(0, 0, 0, 0);

      // Se hoje não está mais disponível, começa de amanhã
      if (!todayIsAvailable) {
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const maxDaysToSearch = numberOfDays * 3; // Busca mais dias para compensar fins de semana
      let daysSearched = 0;

      while (days.length < numberOfDays && daysSearched < maxDaysToSearch) {
        const dayOfWeek = currentDate.getDay();

        // Pula sábado (6) e domingo (0)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          // Verifica disponibilidade chamando o calendar service
          const slots = await calendarService.listAvailableSlots(currentDate, 30);

          // Se for hoje, filtra apenas slots futuros
          let availableSlots = slots;
          if (days.length === 0 && todayIsAvailable) {
            // É hoje - filtra slots que já passaram
            availableSlots = slots.filter((slot) => {
              const slotHour = slot.start.getHours();
              const slotMinute = slot.start.getMinutes();
              // Slot deve ser pelo menos 30 min no futuro
              const slotInMinutes = slotHour * 60 + slotMinute;
              const nowInMinutes = currentHour * 60 + currentMinute + 30;
              return slotInMinutes >= nowInMinutes;
            });
          }

          const hasAvailability = availableSlots.length > 0;

          // Formata a data
          const year = currentDate.getFullYear();
          const month = String(currentDate.getMonth() + 1).padStart(2, "0");
          const day = String(currentDate.getDate()).padStart(2, "0");

          const isToday =
            currentDate.getDate() === now.getDate() &&
            currentDate.getMonth() === now.getMonth() &&
            currentDate.getFullYear() === now.getFullYear();

          days.push({
            date: `${year}-${month}-${day}`,
            dateFormatted: `${day}/${month}/${year}`,
            weekday: WEEKDAYS[dayOfWeek],
            isToday,
            hasAvailability,
            availableSlots: availableSlots.length,
          });
        }

        // Avança para o próximo dia
        currentDate.setDate(currentDate.getDate() + 1);
        daysSearched++;
      }

      // Filtra apenas dias com disponibilidade
      const availableDays = days.filter((d) => d.hasAvailability);

      if (availableDays.length === 0) {
        return JSON.stringify({
          success: true,
          available: false,
          message: "Não há dias disponíveis nos próximos dias úteis.",
          days: [],
        });
      }

      return JSON.stringify({
        success: true,
        available: true,
        message: `Encontrei ${availableDays.length} dia(s) com disponibilidade.`,
        days: availableDays,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Erro ao listar dias disponíveis: ${error.message}`,
      });
    }
  },
  {
    name: "list_available_days",
    description:
      "Lista os próximos dias úteis com disponibilidade para agendamento. " +
      "Use ANTES de oferecer opções de dias ao cliente. " +
      "Retorna dias que têm pelo menos 1 horário livre, pulando fins de semana. " +
      "Cada dia já vem com a data formatada e o dia da semana calculado corretamente.",
    schema: z.object({
      numberOfDays: z
        .number()
        .optional()
        .default(5)
        .describe("Quantidade de dias úteis para buscar (padrão: 5)"),
    }),
  }
);
