import { Bot } from "lucide-react";
import { Card, CardHeader } from "../components/ui/Card";
import { SkeletonKPIs, SkeletonChart } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/ErrorState";
import { KPICards } from "../components/dashboard/KPICards";
import { DateFilter, useDateFilter } from "../components/dashboard/DateFilter";
import { FunnelChart } from "../components/charts/FunnelChart";
import { LeadsOverTimeChart } from "../components/charts/LeadsOverTimeChart";
import { PeakHoursChart } from "../components/charts/PeakHoursChart";
import {
  useKPIs,
  useFunnel,
  useLeadsOverTime,
  usePeakHours,
} from "../hooks/useDashboard";

export function Dashboard() {
  const { dateRange, setDateRange } = useDateFilter();

  const apiDateRange = dateRange.startDate && dateRange.endDate
    ? { startDate: dateRange.startDate, endDate: dateRange.endDate }
    : undefined;

  const { data: kpis, isLoading: loadingKPIs, error: errorKPIs, refetch: refetchKPIs } = useKPIs(apiDateRange);
  const { data: funnel, isLoading: loadingFunnel, error: errorFunnel, refetch: refetchFunnel } = useFunnel(apiDateRange);
  const { data: leadsOverTime, isLoading: loadingLeadsOverTime, error: errorLeadsOverTime, refetch: refetchLeadsOverTime } =
    useLeadsOverTime(apiDateRange);
  const { data: peakHours, isLoading: loadingPeakHours, error: errorPeakHours, refetch: refetchPeakHours } = usePeakHours(apiDateRange);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                Dashboard
              </h1>
              <p className="text-sm text-[var(--text-tertiary)]">
                Metricas automaticas do bot de atendimento
              </p>
            </div>
          </div>
        </div>

        {/* Filtro de data */}
        <DateFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Badge informativo */}
      <div className="flex items-center gap-2 px-4 py-2 bg-primary-500/10 border border-primary-500/20 rounded-xl w-fit">
        <Bot className="w-4 h-4 text-primary-500" />
        <span className="text-sm text-primary-600 dark:text-primary-400">
          Dados coletados automaticamente pelo chatbot
        </span>
      </div>

      {/* KPIs */}
      {loadingKPIs ? (
        <SkeletonKPIs />
      ) : errorKPIs ? (
        <ErrorState
          variant="compact"
          message="Erro ao carregar KPIs"
          onRetry={() => refetchKPIs()}
        />
      ) : kpis ? (
        <KPICards data={kpis} />
      ) : null}

      {/* Graficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funil */}
        {loadingFunnel ? (
          <SkeletonChart />
        ) : errorFunnel ? (
          <ErrorState
            variant="compact"
            message="Erro ao carregar funil"
            onRetry={() => refetchFunnel()}
          />
        ) : funnel ? (
          <Card>
            <CardHeader
              title="Funil de Vendas"
              subtitle="Distribuicao por estagio da conversa"
            />
            <FunnelChart data={funnel.stages} />
          </Card>
        ) : null}

        {/* Leads ao longo do tempo */}
        {loadingLeadsOverTime ? (
          <SkeletonChart />
        ) : errorLeadsOverTime ? (
          <ErrorState
            variant="compact"
            message="Erro ao carregar grafico de leads"
            onRetry={() => refetchLeadsOverTime()}
          />
        ) : leadsOverTime ? (
          <Card>
            <CardHeader
              title="Leads ao Longo do Tempo"
              subtitle={dateRange.label}
            />
            <LeadsOverTimeChart data={leadsOverTime.data} />
          </Card>
        ) : null}

        {/* Horarios de pico */}
        {loadingPeakHours ? (
          <SkeletonChart />
        ) : errorPeakHours ? (
          <ErrorState
            variant="compact"
            message="Erro ao carregar horarios de pico"
            onRetry={() => refetchPeakHours()}
            className="lg:col-span-2"
          />
        ) : peakHours ? (
          <Card className="lg:col-span-2">
            <CardHeader
              title="Horarios de Pico"
              subtitle="Distribuicao de novos leads por hora do dia"
            />
            <PeakHoursChart data={peakHours.data} />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
