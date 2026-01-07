import { calendar } from "../config/google.js";
import { prisma } from "../database/client.js";
import type {
  SellerAvailability,
  AvailabilityResult,
  TimeSlot,
} from "../types/index.js";

const TIMEZONE = "America/Sao_Paulo";

export interface CreatedCalendarEvent {
  eventId: string;
  meetLink: string | null;
}

/**
 * Verifica disponibilidade de todos os vendedores ativos em um horario
 */
export async function checkAvailability(
  startTime: Date,
  endTime: Date
): Promise<AvailabilityResult> {
  // Busca todos os vendedores ativos
  const sellers = await prisma.seller.findMany({
    where: { isActive: true },
  });

  if (sellers.length === 0) {
    return {
      requestedSlot: { start: startTime, end: endTime },
      availableSellers: [],
      unavailableSellers: [],
    };
  }

  // Consulta FreeBusy para todos os calendarios de uma vez
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      timeZone: TIMEZONE,
      items: sellers.map((s) => ({ id: s.calendarId })),
    },
  });

  const calendarsData = response.data.calendars || {};

  const availableSellers: SellerAvailability[] = [];
  const unavailableSellers: SellerAvailability[] = [];

  for (const seller of sellers) {
    const calendarData = calendarsData[seller.calendarId];
    const busySlots: TimeSlot[] = (calendarData?.busy || []).map((slot) => ({
      start: new Date(slot.start!),
      end: new Date(slot.end!),
    }));

    // Verifica se tem conflito com o horario solicitado
    const hasConflict = busySlots.some(
      (slot) => slot.start < endTime && slot.end > startTime
    );

    const availability: SellerAvailability = {
      sellerId: seller.id,
      sellerName: seller.name,
      calendarId: seller.calendarId,
      isAvailable: !hasConflict,
      busySlots,
    };

    if (hasConflict) {
      unavailableSellers.push(availability);
    } else {
      availableSellers.push(availability);
    }
  }

  return {
    requestedSlot: { start: startTime, end: endTime },
    availableSellers,
    unavailableSellers,
  };
}

/**
 * Seleciona um vendedor disponivel (aleatorio entre os disponiveis)
 */
export function selectAvailableSeller(
  availableSellers: SellerAvailability[]
): SellerAvailability | null {
  if (availableSellers.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * availableSellers.length);
  return availableSellers[randomIndex];
}

/**
 * Cria um evento no calendario do vendedor
 */
export async function createCalendarEvent(
  calendarId: string,
  summary: string,
  description: string,
  startTime: Date,
  endTime: Date,
  attendees?: Array<{ email: string; displayName?: string }>
): Promise<CreatedCalendarEvent> {
  /*
   * ========================================================================
   * GOOGLE MEET / JITSI - DESATIVADO TEMPORARIAMENTE
   * ========================================================================
   * Motivo: Usando conta pessoal do Google (Gmail), que não suporta
   * criação de Google Meet via API em calendários de grupo.
   *
   * Para ativar Google Meet:
   * 1. Adquirir Google Workspace (plano pago ~R$28/mês por usuário)
   * 2. Configurar Domain-Wide Delegation para a service account
   * 3. Usar calendário primário do vendedor (email@empresa.com) ao invés
   *    de calendário de grupo (@group.calendar.google.com)
   * 4. Descomentar o código abaixo
   *
   * Alternativa gratuita (Jitsi Meet):
   * - Descomentar o código do Jitsi para gerar links automaticamente
   * ========================================================================
   */

  // --- CÓDIGO DO GOOGLE MEET (requer Google Workspace) ---
  // const isGroupCalendar = calendarId.includes("@group.calendar.google.com");
  // if (!isGroupCalendar) {
  //   requestBody.conferenceData = {
  //     createRequest: {
  //       requestId: `flowlinker-${Date.now()}`,
  //       conferenceSolutionKey: { type: "hangoutsMeet" },
  //     },
  //   };
  // }
  // const response = await calendar.events.insert({
  //   calendarId,
  //   conferenceDataVersion: 1, // Necessário para Google Meet
  //   requestBody,
  // });

  // --- CÓDIGO DO JITSI MEET (alternativa gratuita) ---
  // const jitsiRoomId = `flowlinker-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  // const jitsiLink = `https://meet.jit.si/${jitsiRoomId}`;
  // Adicionar jitsiLink na descrição ou retornar como meetLink

  // Monta o requestBody (sem conferência por enquanto)
  const requestBody: any = {
    summary,
    description,
    attendees: attendees?.length ? attendees : undefined,
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 60 },
        { method: "popup", minutes: 15 },
      ],
    },
    guestsCanModify: false,
    guestsCanInviteOthers: false,
    guestsCanSeeOtherGuests: true,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: TIMEZONE,
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: TIMEZONE,
    },
    visibility: "default",
    status: "confirmed",
  };

  const response = await calendar.events.insert({
    calendarId,
    requestBody,
  });

  if (!response.data.id) {
    throw new Error("Falha ao criar evento no calendario");
  }

  console.log("[Calendar] Evento criado:", {
    eventId: response.data.id,
    htmlLink: response.data.htmlLink,
  });

  return {
    eventId: response.data.id,
    meetLink: null, // Desativado - ver comentário no início da função
  };
}

/**
 * Cancela um evento no calendario
 */
export async function cancelCalendarEvent(
  calendarId: string,
  eventId: string
): Promise<void> {
  await calendar.events.delete({
    calendarId,
    eventId,
  });
}

/**
 * Lista horarios disponiveis em um dia (com pelo menos 1 vendedor livre)
 */
export async function listAvailableSlots(
  date: Date,
  slotDurationMinutes: number = 30,
  startHour: number = 9,
  endHour: number = 18
): Promise<TimeSlot[]> {
  const dayStart = new Date(date);
  dayStart.setHours(startHour, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(endHour, 0, 0, 0);

  const sellers = await prisma.seller.findMany({
    where: { isActive: true },
  });

  if (sellers.length === 0) return [];

  // Busca ocupacao do dia inteiro
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      timeZone: TIMEZONE,
      items: sellers.map((s) => ({ id: s.calendarId })),
    },
  });

  const calendarsData = response.data.calendars || {};

  // Gera todos os slots do dia
  const availableSlots: TimeSlot[] = [];
  let currentSlotStart = new Date(dayStart);

  while (currentSlotStart < dayEnd) {
    const currentSlotEnd = new Date(
      currentSlotStart.getTime() + slotDurationMinutes * 60 * 1000
    );

    if (currentSlotEnd > dayEnd) break;

    // Verifica se pelo menos 1 vendedor esta livre
    const hasAvailableSeller = sellers.some((seller) => {
      const busy = calendarsData[seller.calendarId]?.busy || [];
      return !busy.some(
        (slot) =>
          new Date(slot.start!) < currentSlotEnd &&
          new Date(slot.end!) > currentSlotStart
      );
    });

    if (hasAvailableSeller) {
      availableSlots.push({
        start: new Date(currentSlotStart),
        end: new Date(currentSlotEnd),
      });
    }

    currentSlotStart = new Date(currentSlotEnd);
  }

  return availableSlots;
}
