export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface SellerAvailability {
  sellerId: string;
  sellerName: string;
  calendarId: string;
  isAvailable: boolean;
  busySlots: TimeSlot[];
}

export interface AvailabilityResult {
  requestedSlot: TimeSlot;
  availableSellers: SellerAvailability[];
  unavailableSellers: SellerAvailability[];
}

export interface MeetingRequest {
  clientPhone: string;
  clientName?: string;
  clientEmail?: string;
  subject?: string;
  startTime: Date;
  endTime: Date;
  sellerId?: string; // Se nao especificado, escolhe automaticamente
  // Dados de qualificacao do lead
  clientCity?: string;
  clientState?: string;
  clientCityPopulation?: number;
  clientSegment?: string; // negocios, pessoal ou politico
  observations?: string;
}

export interface MeetingResult {
  success: boolean;
  meetingId?: string;
  eventId?: string;
  meetLink?: string | null;
  reminderAt?: Date;
  sellerName?: string;
  sellerEmail?: string;
  sellerPhone?: string | null;
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

export interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text?: string;
    };
  };
}

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: EvolutionMessage;
}
