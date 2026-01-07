import { prisma } from "../database/client.js";
import * as calendarService from "./calendar.js";
import * as sellerService from "./seller.js";
import type { MeetingRequest, MeetingResult } from "../types/index.js";

/**
 * Agenda uma reuniao com um vendedor disponivel
 */
export async function scheduleMeeting(
  request: MeetingRequest
): Promise<MeetingResult> {
  const {
    clientPhone,
    clientName,
    clientEmail,
    subject,
    startTime,
    endTime,
    sellerId,
    clientCity,
    clientState,
    clientCityPopulation,
    clientSegment,
    observations,
  } = request;

  try {
    let selectedSeller;

    if (sellerId) {
      // Se um vendedor especifico foi solicitado, verifica se esta disponivel
      const seller = await sellerService.getSellerById(sellerId);
      if (!seller) {
        return { success: false, error: "Vendedor nao encontrado" };
      }

      const availability = await calendarService.checkAvailability(
        startTime,
        endTime
      );
      const isAvailable = availability.availableSellers.some(
        (s) => s.sellerId === sellerId
      );

      if (!isAvailable) {
        return {
          success: false,
          error: `${seller.name} nao esta disponivel neste horario`,
        };
      }

      selectedSeller = seller;
    } else {
      // Seleciona automaticamente um vendedor disponivel
      const availability = await calendarService.checkAvailability(
        startTime,
        endTime
      );

      if (availability.availableSellers.length === 0) {
        return {
          success: false,
          error: "Nenhum vendedor disponivel neste horario",
        };
      }

      const selected = calendarService.selectAvailableSeller(
        availability.availableSellers
      );
      if (!selected) {
        return { success: false, error: "Erro ao selecionar vendedor" };
      }

      selectedSeller = await sellerService.getSellerById(selected.sellerId);
      if (!selectedSeller) {
        return { success: false, error: "Vendedor nao encontrado" };
      }
    }

    // Cria evento no calendario
    // Nao pede "titulo" pro cliente; usa um padrao interno
    const summary = `Demo Flowlinker - ${clientName || clientPhone}`;

    // Formata a população para exibição (ex: 580.000 habitantes)
    const populacaoFormatada = clientCityPopulation
      ? `${clientCityPopulation.toLocaleString("pt-BR")} habitantes`
      : null;

    // Monta a localização do cliente
    const localizacao =
      clientCity && clientState
        ? `${clientCity}/${clientState}${populacaoFormatada ? ` (${populacaoFormatada})` : ""}`
        : null;

    // Monta a descrição do evento com todos os dados disponíveis
    const descriptionParts = [
      `DADOS DO CLIENTE`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Nome: ${clientName || "Nao informado"}`,
      `Telefone: ${clientPhone}`,
      `Email: ${clientEmail || "Nao informado"}`,
      localizacao ? `Cidade: ${localizacao}` : null,
      clientSegment ? `Segmento: ${clientSegment}` : null,
      ``,
      `DETALHES DA REUNIAO`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Assunto: ${subject || "Demo Flowlinker"}`,
      observations ? `Observacoes: ${observations}` : null,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Agendado automaticamente pelo bot.`,
    ];

    const description = descriptionParts.filter(Boolean).join("\n");

    const created = await calendarService.createCalendarEvent(
      selectedSeller.calendarId,
      summary,
      description,
      startTime,
      endTime
    );

    const reminderAt = new Date(startTime.getTime() - 15 * 60 * 1000);

    // Salva no banco
    const meeting = await prisma.meeting.create({
      data: {
        sellerId: selectedSeller.id,
        clientPhone,
        clientName,
        clientEmail,
        subject,
        startTime,
        endTime,
        eventId: created.eventId,
        meetLink: created.meetLink,
        reminderAt,
      } as any,
    });

    return {
      success: true,
      meetingId: meeting.id,
      eventId: created.eventId,
      meetLink: created.meetLink,
      reminderAt,
      sellerName: selectedSeller.name,
      sellerEmail: selectedSeller.email,
      sellerPhone: selectedSeller.phone || null,
      startTime,
      endTime,
    };
  } catch (error: any) {
    console.error("Erro ao agendar reuniao:", error);
    return {
      success: false,
      error: error.message || "Erro desconhecido ao agendar reuniao",
    };
  }
}

/**
 * Cancela uma reuniao
 */
export async function cancelMeeting(meetingId: string): Promise<boolean> {
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { seller: true },
    });

    if (!meeting) return false;

    // Remove do calendario
    await calendarService.cancelCalendarEvent(
      meeting.seller.calendarId,
      meeting.eventId
    );

    // Atualiza status no banco
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: "CANCELLED" },
    });

    return true;
  } catch (error) {
    console.error("Erro ao cancelar reuniao:", error);
    return false;
  }
}

/**
 * Busca reunioes de um cliente por telefone
 */
export async function getMeetingsByPhone(phone: string) {
  return prisma.meeting.findMany({
    where: {
      clientPhone: phone,
      status: "SCHEDULED",
      startTime: { gte: new Date() },
    },
    include: { seller: true },
    orderBy: { startTime: "asc" },
  });
}

/**
 * Busca reunioes de um cliente por email
 */
export async function getMeetingsByEmail(email: string) {
  return prisma.meeting.findMany({
    where: {
      clientEmail: email,
      status: "SCHEDULED",
      startTime: { gte: new Date() },
    } as any,
    include: { seller: true },
    orderBy: { startTime: "asc" },
  });
}

/**
 * Remarca uma reuniao:
 * - na pratica cria uma NOVA reuniao (novo evento no Google Calendar)
 * - e cancela a reuniao antiga (apaga evento no Google Calendar e marca CANCELLED no banco)
 *
 * Isso evita a necessidade de atualizar/patch de evento e mantem um historico consistente no banco.
 */
export async function rescheduleMeeting(params: {
  oldMeetingId: string;
  newStartTime: Date;
}): Promise<
  | { success: true; oldMeetingId: string; newMeeting: MeetingResult }
  | { success: false; error: string }
> {
  const { oldMeetingId, newStartTime } = params;
  const newEndTime = new Date(newStartTime.getTime() + 30 * 60 * 1000);

  try {
    const oldMeeting = await prisma.meeting.findUnique({
      where: { id: oldMeetingId },
      include: { seller: true },
    });

    if (!oldMeeting) {
      return { success: false, error: "Reuniao nao encontrada" };
    }

    if (oldMeeting.status !== "SCHEDULED") {
      return {
        success: false,
        error: "Essa reuniao nao esta ativa para remarcar",
      };
    }

    // Tenta manter o mesmo vendedor se ele estiver disponivel no novo horario
    let sellerIdToUse: string | undefined = undefined;
    try {
      const availability = await calendarService.checkAvailability(
        newStartTime,
        newEndTime
      );
      const sameSellerAvailable = availability.availableSellers.some(
        (s) => s.sellerId === oldMeeting.sellerId
      );
      if (sameSellerAvailable) sellerIdToUse = oldMeeting.sellerId;
    } catch {
      // se falhar a checagem, deixa o agendamento automatico escolher
    }

    // Cria a nova reuniao primeiro (se falhar, nao cancela a antiga)
    const newMeeting = await scheduleMeeting({
      clientPhone: oldMeeting.clientPhone,
      clientName: oldMeeting.clientName || undefined,
      clientEmail: (oldMeeting as any).clientEmail || undefined,
      subject: oldMeeting.subject || undefined,
      startTime: newStartTime,
      endTime: newEndTime,
      sellerId: sellerIdToUse,
    });

    if (!newMeeting.success) {
      return {
        success: false,
        error: newMeeting.error || "Falha ao criar nova reuniao",
      };
    }

    // Cancela a reuniao antiga (Calendar + DB)
    await cancelMeeting(oldMeetingId);

    return {
      success: true,
      oldMeetingId,
      newMeeting,
    };
  } catch (error: any) {
    console.error("Erro ao remarcar reuniao:", error);
    return {
      success: false,
      error: error.message || "Erro desconhecido ao remarcar",
    };
  }
}
