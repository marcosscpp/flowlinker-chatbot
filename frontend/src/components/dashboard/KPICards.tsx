import {
  Users,
  UserPlus,
  TrendingUp,
  Calendar,
  XCircle,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import type { DashboardKPIs } from "../../api/types";

interface KPICardsProps {
  data: DashboardKPIs;
}

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  gradient: string;
  iconBg: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}

function KPICard({
  title,
  value,
  icon: Icon,
  gradient,
  iconBg,
  change,
  changeType = "neutral",
}: KPICardProps) {
  return (
    <div className="relative group">
      {/* Glow effect on hover */}
      <div
        className={`absolute -inset-0.5 ${gradient} rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-500`}
      />

      {/* Card */}
      <div className="relative bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-6 transition-all duration-300 hover:border-transparent">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--text-tertiary)]">
              {title}
            </p>
            <p className="text-3xl font-bold text-[var(--text-primary)]">
              {value}
            </p>
            {change && (
              <p
                className={`text-xs font-medium ${
                  changeType === "positive"
                    ? "text-green-500"
                    : changeType === "negative"
                    ? "text-red-500"
                    : "text-[var(--text-tertiary)]"
                }`}
              >
                {change}
              </p>
            )}
          </div>

          {/* Icon with gradient background */}
          <div
            className={`flex items-center justify-center w-14 h-14 rounded-2xl ${iconBg}`}
          >
            <Icon className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* Bottom gradient line */}
        <div
          className={`absolute bottom-0 left-6 right-6 h-1 ${gradient} rounded-full opacity-50`}
        />
      </div>
    </div>
  );
}

export function KPICards({ data }: KPICardsProps) {
  const kpis = [
    {
      title: "Total de Leads",
      value: data.totalLeads.toLocaleString("pt-BR"),
      icon: Users,
      gradient: "bg-gradient-to-r from-primary-500 to-primary-600",
      iconBg: "bg-gradient-to-br from-primary-500 to-primary-700",
      change: "Captados pelo bot",
      changeType: "neutral" as const,
    },
    {
      title: "Novos Hoje",
      value: data.newLeadsToday.toLocaleString("pt-BR"),
      icon: UserPlus,
      gradient: "bg-gradient-to-r from-emerald-500 to-green-600",
      iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
      change: "Entradas hoje",
      changeType: "positive" as const,
    },
    {
      title: "Taxa de Conversao",
      value: `${data.conversionRate.toFixed(1)}%`,
      icon: TrendingUp,
      gradient: "bg-gradient-to-r from-violet-500 to-purple-600",
      iconBg: "bg-gradient-to-br from-violet-500 to-purple-600",
      change: "Leads → Reuniao",
      changeType: "neutral" as const,
    },
    {
      title: "Reunioes Agendadas",
      value: data.meetingsScheduled.toLocaleString("pt-BR"),
      icon: Calendar,
      gradient: "bg-gradient-to-r from-orange-500 to-amber-600",
      iconBg: "bg-gradient-to-br from-orange-500 to-amber-500",
      change: "Agendadas pelo bot",
      changeType: "neutral" as const,
    },
    {
      title: "Cancelamentos",
      value: data.meetingsCancelled.toLocaleString("pt-BR"),
      icon: XCircle,
      gradient: "bg-gradient-to-r from-rose-500 to-red-600",
      iconBg: "bg-gradient-to-br from-rose-500 to-red-600",
      change: `${data.meetingsNoShow} no-show`,
      changeType: "negative" as const,
    },
    {
      title: "Conversas Ativas",
      value: data.activeConversations.toLocaleString("pt-BR"),
      icon: MessageCircle,
      gradient: "bg-gradient-to-r from-cyan-500 to-blue-600",
      iconBg: "bg-gradient-to-br from-cyan-500 to-blue-600",
      change: "Em andamento",
      changeType: "neutral" as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {kpis.map((kpi) => (
        <KPICard key={kpi.title} {...kpi} />
      ))}
    </div>
  );
}
