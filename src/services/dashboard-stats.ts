import { prisma } from "../database/client.js";

/**
 * KPIs do dashboard
 */
export interface DashboardKPIs {
  totalLeads: number;
  newLeadsToday: number;
  conversionRate: number;
  meetingsScheduled: number;
  meetingsCompleted: number;
  meetingsCancelled: number;
  meetingsNoShow: number;
  activeConversations: number;
  reactivationsPending: number;
}

/**
 * Dados do funil de vendas
 */
export interface FunnelData {
  stages: Array<{
    name: string;
    label: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Dados de leads ao longo do tempo
 */
export interface LeadsOverTimeData {
  data: Array<{
    date: string;
    newLeads: number;
    converted: number;
    discarded: number;
  }>;
}

/**
 * Dados de horários de pico
 */
export interface PeakHoursData {
  data: Array<{
    hour: number;
    count: number;
  }>;
}

/**
 * Obtém início e fim do dia atual (timezone São Paulo)
 */
function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Calcula KPIs do dashboard
 */
export async function getKPIs(
  startDate?: Date,
  endDate?: Date
): Promise<DashboardKPIs> {
  const dateFilter = startDate && endDate
    ? { createdAt: { gte: startDate, lte: endDate } }
    : {};

  const meetingDateFilter = startDate && endDate
    ? { createdAt: { gte: startDate, lte: endDate } }
    : {};

  const today = getTodayRange();

  // Executa queries em paralelo
  const [
    totalLeads,
    newLeadsToday,
    convertedLeads,
    meetingsScheduled,
    meetingsCompleted,
    meetingsCancelled,
    meetingsNoShow,
    activeConversations,
    reactivationsPending,
  ] = await Promise.all([
    // Total de leads
    prisma.conversationLog.count({ where: dateFilter }),

    // Leads novos hoje
    prisma.conversationLog.count({
      where: {
        createdAt: { gte: today.start, lte: today.end },
      },
    }),

    // Leads convertidos
    prisma.conversationLog.count({
      where: {
        ...dateFilter,
        conversationStatus: "CONVERTED",
      },
    }),

    // Reuniões agendadas
    prisma.meeting.count({
      where: {
        ...meetingDateFilter,
        status: "SCHEDULED",
      },
    }),

    // Reuniões completadas
    prisma.meeting.count({
      where: {
        ...meetingDateFilter,
        status: "COMPLETED",
      },
    }),

    // Reuniões canceladas
    prisma.meeting.count({
      where: {
        ...meetingDateFilter,
        status: "CANCELLED",
      },
    }),

    // No-shows
    prisma.meeting.count({
      where: {
        ...meetingDateFilter,
        status: "NO_SHOW",
      },
    }),

    // Conversas ativas
    prisma.conversationLog.count({
      where: {
        conversationStatus: "ACTIVE",
      },
    }),

    // Reativações pendentes
    prisma.reactivationQueue.count({
      where: {
        status: "PENDING",
      },
    }),
  ]);

  const conversionRate =
    totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

  return {
    totalLeads,
    newLeadsToday,
    conversionRate: Math.round(conversionRate * 100) / 100,
    meetingsScheduled,
    meetingsCompleted,
    meetingsCancelled,
    meetingsNoShow,
    activeConversations,
    reactivationsPending,
  };
}

/**
 * Obtém dados do funil de vendas
 */
export async function getFunnelData(
  startDate?: Date,
  endDate?: Date
): Promise<FunnelData> {
  const dateFilter = startDate && endDate
    ? { createdAt: { gte: startDate, lte: endDate } }
    : {};

  // Definição dos estágios do funil
  const stageDefinitions = [
    { name: "greeting", label: "Saudação" },
    { name: "city_collected", label: "Cidade Coletada" },
    { name: "segment_collected", label: "Segmento Coletado" },
    { name: "day_selected", label: "Dia Selecionado" },
    { name: "meeting_scheduled", label: "Reunião Agendada" },
  ];

  // Conta leads por estágio
  const stageCounts = await Promise.all(
    stageDefinitions.map(async (stage) => {
      const count = await prisma.conversationLog.count({
        where: {
          ...dateFilter,
          stage: stage.name,
        },
      });
      return { ...stage, count };
    })
  );

  // Também conta os convertidos (status CONVERTED)
  const convertedCount = await prisma.conversationLog.count({
    where: {
      ...dateFilter,
      conversationStatus: "CONVERTED",
    },
  });

  // Atualiza o estágio meeting_scheduled com convertidos
  const meetingStageIndex = stageCounts.findIndex(
    (s) => s.name === "meeting_scheduled"
  );
  if (meetingStageIndex !== -1) {
    stageCounts[meetingStageIndex].count = Math.max(
      stageCounts[meetingStageIndex].count,
      convertedCount
    );
  }

  // Calcula total para percentuais
  const total = stageCounts.reduce((sum, s) => sum + s.count, 0) || 1;

  return {
    stages: stageCounts.map((stage) => ({
      ...stage,
      percentage: Math.round((stage.count / total) * 100 * 100) / 100,
    })),
  };
}

/**
 * Obtém leads ao longo do tempo
 */
export async function getLeadsOverTime(
  startDate: Date,
  endDate: Date,
  granularity: "day" | "week" | "month" = "day"
): Promise<LeadsOverTimeData> {
  // Busca todos os leads no período
  const leads = await prisma.conversationLog.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      createdAt: true,
      conversationStatus: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Agrupa por data
  const groupedData = new Map<
    string,
    { newLeads: number; converted: number; discarded: number }
  >();

  leads.forEach((lead) => {
    let dateKey: string;

    if (granularity === "day") {
      dateKey = lead.createdAt.toISOString().split("T")[0];
    } else if (granularity === "week") {
      const weekStart = new Date(lead.createdAt);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      dateKey = weekStart.toISOString().split("T")[0];
    } else {
      dateKey = lead.createdAt.toISOString().slice(0, 7); // YYYY-MM
    }

    const existing = groupedData.get(dateKey) || {
      newLeads: 0,
      converted: 0,
      discarded: 0,
    };

    existing.newLeads++;
    if (lead.conversationStatus === "CONVERTED") {
      existing.converted++;
    } else if (lead.conversationStatus === "DISCARDED") {
      existing.discarded++;
    }

    groupedData.set(dateKey, existing);
  });

  // Converte para array ordenado
  const data = Array.from(groupedData.entries())
    .map(([date, values]) => ({
      date,
      ...values,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { data };
}

/**
 * Obtém horários de pico (baseado na hora de criação dos leads)
 */
export async function getPeakHours(
  startDate?: Date,
  endDate?: Date
): Promise<PeakHoursData> {
  const dateFilter = startDate && endDate
    ? { createdAt: { gte: startDate, lte: endDate } }
    : {};

  const leads = await prisma.conversationLog.findMany({
    where: dateFilter,
    select: { createdAt: true },
  });

  // Agrupa por hora
  const hourCounts = new Map<number, number>();

  // Inicializa todas as horas com 0
  for (let i = 0; i < 24; i++) {
    hourCounts.set(i, 0);
  }

  leads.forEach((lead) => {
    // Ajusta para timezone de São Paulo (UTC-3)
    const hour = (lead.createdAt.getUTCHours() - 3 + 24) % 24;
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  });

  return {
    data: Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour),
  };
}

/**
 * Lista de leads paginada
 */
export interface LeadListItem {
  id: string;
  phone: string;
  conversationStatus: string;
  stage: string | null;
  lastContactAt: Date;
  createdAt: Date;
  reactivationAttempts: number;
  hasSummary: boolean;
  hasMeeting: boolean;
  meetingDate: Date | null;
}

export interface PaginatedLeads {
  data: LeadListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function getLeadsList(
  page: number = 1,
  limit: number = 20,
  status?: string,
  search?: string
): Promise<PaginatedLeads> {
  const skip = (page - 1) * limit;

  const where: any = {};

  if (status) {
    where.conversationStatus = status;
  }

  if (search) {
    where.phone = { contains: search };
  }

  const [leads, total] = await Promise.all([
    prisma.conversationLog.findMany({
      where,
      select: {
        id: true,
        phone: true,
        conversationStatus: true,
        stage: true,
        lastContactAt: true,
        createdAt: true,
        reactivationAttempts: true,
        summary: {
          select: { id: true },
        },
      },
      orderBy: { lastContactAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.conversationLog.count({ where }),
  ]);

  // Busca reuniões para os leads
  const phones = leads.map((l) => l.phone);
  const meetings = await prisma.meeting.findMany({
    where: {
      clientPhone: { in: phones },
      status: "SCHEDULED",
      startTime: { gte: new Date() },
    },
    select: {
      clientPhone: true,
      startTime: true,
    },
  });

  const meetingsByPhone = new Map(
    meetings.map((m) => [m.clientPhone, m.startTime])
  );

  const data: LeadListItem[] = leads.map((lead) => ({
    id: lead.id,
    phone: lead.phone,
    conversationStatus: lead.conversationStatus,
    stage: lead.stage,
    lastContactAt: lead.lastContactAt,
    createdAt: lead.createdAt,
    reactivationAttempts: lead.reactivationAttempts,
    hasSummary: !!lead.summary,
    hasMeeting: meetingsByPhone.has(lead.phone),
    meetingDate: meetingsByPhone.get(lead.phone) || null,
  }));

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Detalhes completos de um lead
 */
export interface LeadDetails {
  id: string;
  phone: string;
  conversationStatus: string;
  stage: string | null;
  lastContactAt: Date;
  createdAt: Date;
  reactivationAttempts: number;
  discardReason: string | null;
  messages: Array<{ role: string; content: string }>;
  meetings: Array<{
    id: string;
    startTime: Date;
    endTime: Date;
    status: string;
    meetLink: string | null;
    sellerName: string;
  }>;
  reactivationHistory: Array<{
    id: string;
    message: string;
    status: string;
    scheduledAt: Date;
    sentAt: Date | null;
  }>;
}

export async function getLeadDetails(leadId: string): Promise<LeadDetails | null> {
  const lead = await prisma.conversationLog.findUnique({
    where: { id: leadId },
    include: {
      reactivationQueue: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!lead) {
    return null;
  }

  // Busca reuniões
  const meetings = await prisma.meeting.findMany({
    where: { clientPhone: lead.phone },
    include: { seller: { select: { name: true } } },
    orderBy: { startTime: "desc" },
  });

  return {
    id: lead.id,
    phone: lead.phone,
    conversationStatus: lead.conversationStatus,
    stage: lead.stage,
    lastContactAt: lead.lastContactAt,
    createdAt: lead.createdAt,
    reactivationAttempts: lead.reactivationAttempts,
    discardReason: lead.discardReason,
    messages: (lead.messages as Array<{ role: string; content: string }>) || [],
    meetings: meetings.map((m) => ({
      id: m.id,
      startTime: m.startTime,
      endTime: m.endTime,
      status: m.status,
      meetLink: m.meetLink,
      sellerName: m.seller.name,
    })),
    reactivationHistory: lead.reactivationQueue.map((r) => ({
      id: r.id,
      message: r.message,
      status: r.status,
      scheduledAt: r.scheduledAt,
      sentAt: r.sentAt,
    })),
  };
}
