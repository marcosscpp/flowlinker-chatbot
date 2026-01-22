import api from "./client";
import type {
  DashboardKPIs,
  FunnelData,
  LeadsOverTimeData,
  PeakHoursData,
  PaginatedLeads,
  LeadWithSummary,
  LeadSummary,
} from "./types";

interface DateRange {
  startDate?: string;
  endDate?: string;
}

export async function getKPIs(dateRange?: DateRange): Promise<DashboardKPIs> {
  const params = new URLSearchParams();
  if (dateRange?.startDate) params.append("startDate", dateRange.startDate);
  if (dateRange?.endDate) params.append("endDate", dateRange.endDate);

  const { data } = await api.get<DashboardKPIs>(`/kpis?${params.toString()}`);
  return data;
}

export async function getFunnel(dateRange?: DateRange): Promise<FunnelData> {
  const params = new URLSearchParams();
  if (dateRange?.startDate) params.append("startDate", dateRange.startDate);
  if (dateRange?.endDate) params.append("endDate", dateRange.endDate);

  const { data } = await api.get<FunnelData>(`/funnel?${params.toString()}`);
  return data;
}

export async function getLeadsOverTime(
  dateRange?: DateRange,
  granularity: "day" | "week" | "month" = "day"
): Promise<LeadsOverTimeData> {
  const params = new URLSearchParams();
  if (dateRange?.startDate) params.append("startDate", dateRange.startDate);
  if (dateRange?.endDate) params.append("endDate", dateRange.endDate);
  params.append("granularity", granularity);

  const { data } = await api.get<LeadsOverTimeData>(
    `/leads-over-time?${params.toString()}`
  );
  return data;
}

export async function getPeakHours(
  dateRange?: DateRange
): Promise<PeakHoursData> {
  const params = new URLSearchParams();
  if (dateRange?.startDate) params.append("startDate", dateRange.startDate);
  if (dateRange?.endDate) params.append("endDate", dateRange.endDate);

  const { data } = await api.get<PeakHoursData>(
    `/peak-hours?${params.toString()}`
  );
  return data;
}

export async function getLeads(
  page: number = 1,
  limit: number = 20,
  status?: string,
  search?: string
): Promise<PaginatedLeads> {
  const params = new URLSearchParams();
  params.append("page", page.toString());
  params.append("limit", limit.toString());
  if (status) params.append("status", status);
  if (search) params.append("search", search);

  const { data } = await api.get<PaginatedLeads>(`/leads?${params.toString()}`);
  return data;
}

export async function getLead(id: string): Promise<LeadWithSummary> {
  const { data } = await api.get<LeadWithSummary>(`/leads/${id}`);
  return data;
}

export async function regenerateSummary(id: string): Promise<LeadSummary> {
  const { data } = await api.post<LeadSummary>(`/leads/${id}/regenerate-summary`);
  return data;
}
