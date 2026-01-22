import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LeadsOverTimeItem } from "../../api/types";

interface LeadsOverTimeChartProps {
  data: LeadsOverTimeItem[];
}

export function LeadsOverTimeChart({ data }: LeadsOverTimeChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    dateFormatted: format(parseISO(item.date), "dd/MM", { locale: ptBR }),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={formattedData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorNewLeads" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorConverted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="var(--border-color)"
        />
        <XAxis
          dataKey="dateFormatted"
          tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border-color)" }}
        />
        <YAxis
          tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          labelFormatter={(_, payload) => {
            if (payload && payload[0]) {
              return format(parseISO(payload[0].payload.date), "dd/MM/yyyy", {
                locale: ptBR,
              });
            }
            return "";
          }}
          contentStyle={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            color: "var(--text-primary)",
          }}
        />
        <Legend
          wrapperStyle={{ color: "var(--text-secondary)" }}
        />
        <Area
          type="monotone"
          dataKey="newLeads"
          name="Novos Leads"
          stroke="#a855f7"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorNewLeads)"
        />
        <Area
          type="monotone"
          dataKey="converted"
          name="Convertidos"
          stroke="#22c55e"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorConverted)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
