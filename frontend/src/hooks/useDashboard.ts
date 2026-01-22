import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getKPIs,
  getFunnel,
  getLeadsOverTime,
  getPeakHours,
  getLeads,
  getLead,
  regenerateSummary,
} from "../api/dashboard";

interface DateRange {
  startDate?: string;
  endDate?: string;
}

export function useKPIs(dateRange?: DateRange) {
  return useQuery({
    queryKey: ["kpis", dateRange],
    queryFn: () => getKPIs(dateRange),
  });
}

export function useFunnel(dateRange?: DateRange) {
  return useQuery({
    queryKey: ["funnel", dateRange],
    queryFn: () => getFunnel(dateRange),
  });
}

export function useLeadsOverTime(
  dateRange?: DateRange,
  granularity: "day" | "week" | "month" = "day"
) {
  return useQuery({
    queryKey: ["leads-over-time", dateRange, granularity],
    queryFn: () => getLeadsOverTime(dateRange, granularity),
  });
}

export function usePeakHours(dateRange?: DateRange) {
  return useQuery({
    queryKey: ["peak-hours", dateRange],
    queryFn: () => getPeakHours(dateRange),
  });
}

export function useLeads(
  page: number = 1,
  limit: number = 20,
  status?: string,
  search?: string
) {
  return useQuery({
    queryKey: ["leads", page, limit, status, search],
    queryFn: () => getLeads(page, limit, status, search),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ["lead", id],
    queryFn: () => getLead(id),
    enabled: !!id,
  });
}

export function useRegenerateSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: regenerateSummary,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
    },
  });
}
