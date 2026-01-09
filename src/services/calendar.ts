import { calendar } from "../config/google.js";
import { prisma } from "../database/client.js";
import type {
  SellerAvailability,
  AvailabilityResult,
  TimeSlot,
} from "../types/index.js";

const TIMEZONE = "America/Sao_Paulo";

/**
 * Formata uma data para o formato ISO sem indicador UTC (Z)
 * Isso permite que o Google Calendar use o timeZone especificado corretamente
 */
function formatDateTimeForCalendar(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

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

  // Log dos vendedores disponíveis e ocupados
  console.log(`\n[Disponibilidade] Horário: ${startTime.toLocaleString("pt-BR")} - ${endTime.toLocaleString("pt-BR")}`);
  console.log(`[Disponibilidade] Vendedores LIVRES (${availableSellers.length}):`);
  availableSellers.forEach((s) => console.log(`  ✅ ${s.sellerName}`));
  console.log(`[Disponibilidade] Vendedores OCUPADOS (${unavailableSellers.length}):`);
  unavailableSellers.forEach((s) => {
    const busyInfo = s.busySlots.map((slot) => 
      `${slot.start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} - ${slot.end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    ).join(", ");
    console.log(`  ❌ ${s.sellerName} (ocupado: ${busyInfo})`);
  });

  return {
    requestedSlot: { start: startTime, end: endTime },
    availableSellers,
    unavailableSellers,
  };
}

/**
 * Seleciona um vendedor disponivel usando round-robin
 * Escolhe o vendedor com MENOS reuniões futuras agendadas
 */
export async function selectAvailableSeller(
  availableSellers: SellerAvailability[]
): Promise<SellerAvailability | null> {
  if (availableSellers.length === 0) return null;

  // Se só tem 1 vendedor, retorna ele
  if (availableSellers.length === 1) return availableSellers[0];

  // Busca contagem de reuniões futuras para cada vendedor disponível
  const now = new Date();
  const sellerIds = availableSellers.map((s) => s.sellerId);

  const meetingCounts = await prisma.meeting.groupBy({
    by: ["sellerId"],
    where: {
      sellerId: { in: sellerIds },
      status: "SCHEDULED",
      startTime: { gte: now },
    },
    _count: { sellerId: true },
  });

  // Cria mapa de contagem (vendedor -> quantidade de reuniões)
  const countMap = new Map<string, number>();
  for (const mc of meetingCounts) {
    countMap.set(mc.sellerId, mc._count.sellerId);
  }

  // Encontra o vendedor com menos reuniões
  let minCount = Infinity;
  let selectedSeller: SellerAvailability | null = null;

  for (const seller of availableSellers) {
    const count = countMap.get(seller.sellerId) || 0;
    if (count < minCount) {
      minCount = count;
      selectedSeller = seller;
    }
  }

  console.log(
    `[Round-Robin] Vendedor selecionado: ${selectedSeller?.sellerName} (${minCount} reuniões futuras)`
  );

  return selectedSeller;
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
  // Monta o requestBody com Google Meet habilitado
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
      dateTime: formatDateTimeForCalendar(startTime),
      timeZone: TIMEZONE,
    },
    end: {
      dateTime: formatDateTimeForCalendar(endTime),
      timeZone: TIMEZONE,
    },
    visibility: "default",
    status: "confirmed",
    // Google Meet - gera link automaticamente
    conferenceData: {
      createRequest: {
        requestId: `flowlinker-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const response = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1, // Necessário para criar Google Meet
    requestBody,
  });

  if (!response.data.id) {
    throw new Error("Falha ao criar evento no calendario");
  }

  // Extrai o link do Google Meet
  const meetLink =
    response.data.conferenceData?.entryPoints?.find(
      (e) => e.entryPointType === "video"
    )?.uri || null;

  console.log("[Calendar] Evento criado:", {
    eventId: response.data.id,
    htmlLink: response.data.htmlLink,
    meetLink,
  });

  return {
    eventId: response.data.id,
    meetLink,
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
  endHour: number = 18,
  endMinute: number = 30
): Promise<TimeSlot[]> {
  // Verifica se é fim de semana (0 = domingo, 6 = sábado)
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return []; // Não agenda em fins de semana
  }

  const now = new Date();
  const dayStart = new Date(date);
  dayStart.setHours(startHour, 0, 0, 0);

  // Se for hoje, começa a partir do horário atual (arredondado para o próximo slot)
  const isToday = date.toDateString() === now.toDateString();
  if (isToday && now > dayStart) {
    // Arredonda para o próximo slot de 30 minutos
    const minutes = now.getMinutes();
    const nextSlotMinutes =
      Math.ceil(minutes / slotDurationMinutes) * slotDurationMinutes;
    dayStart.setHours(now.getHours(), nextSlotMinutes, 0, 0);

    // Se o arredondamento passou para a próxima hora
    if (nextSlotMinutes >= 60) {
      dayStart.setHours(now.getHours() + 1, 0, 0, 0);
    }
  }

  const dayEnd = new Date(date);
  // Último slot deve TERMINAR às 18:30, então último início é 18:00
  // endHour=18, endMinute=30 significa que reuniões devem terminar até 18:30
  // Com slots de 30min, último início permitido é 18:00
  dayEnd.setHours(endHour, endMinute, 0, 0);

  // Se for hoje e já passou do horário comercial, retorna vazio
  if (isToday && dayStart >= dayEnd) {
    return [];
  }

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
