// KPIs
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

// Funil
export interface FunnelStage {
  name: string;
  label: string;
  count: number;
  percentage: number;
}

export interface FunnelData {
  stages: FunnelStage[];
}

// Leads ao longo do tempo
export interface LeadsOverTimeItem {
  date: string;
  newLeads: number;
  converted: number;
  discarded: number;
}

export interface LeadsOverTimeData {
  data: LeadsOverTimeItem[];
}

// Horarios de pico
export interface PeakHourItem {
  hour: number;
  count: number;
}

export interface PeakHoursData {
  data: PeakHourItem[];
}

// Lista de leads
export interface LeadListItem {
  id: string;
  phone: string;
  conversationStatus: string;
  stage: string | null;
  lastContactAt: string;
  createdAt: string;
  reactivationAttempts: number;
  hasSummary: boolean;
  hasMeeting: boolean;
  meetingDate: string | null;
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

// Detalhes do lead
export interface LeadMessage {
  role: string;
  content: string;
  timestamp?: string | number;
}

export interface LeadMeeting {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  meetLink: string | null;
  sellerName: string;
}

export interface LeadReactivation {
  id: string;
  message: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
}

export interface LeadDetails {
  id: string;
  phone: string;
  conversationStatus: string;
  stage: string | null;
  lastContactAt: string;
  createdAt: string;
  reactivationAttempts: number;
  discardReason: string | null;
  messages: LeadMessage[];
  meetings: LeadMeeting[];
  reactivationHistory: LeadReactivation[];
}

export interface LeadSummary {
  text: string;
  keyPoints: string[];
  sentiment: "positivo" | "neutro" | "negativo";
  isCached: boolean;
}

export interface LeadWithSummary {
  lead: LeadDetails;
  summary: LeadSummary | null;
}
