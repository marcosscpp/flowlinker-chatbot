import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PeakHourItem } from "../../api/types";

interface PeakHoursChartProps {
  data: PeakHourItem[];
}

export function PeakHoursChart({ data }: PeakHoursChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    hourFormatted: `${item.hour.toString().padStart(2, "0")}h`,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={formattedData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity={1} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={1} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="var(--border-color)"
        />
        <XAxis
          dataKey="hourFormatted"
          tick={{ fill: "var(--text-tertiary)", fontSize: 10 }}
          tickLine={false}
          interval={1}
          axisLine={{ stroke: "var(--border-color)" }}
        />
        <YAxis
          tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value: number) => [value, "Leads"]}
          labelFormatter={(label) => `Horario: ${label}`}
          contentStyle={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            color: "var(--text-primary)",
          }}
        />
        <Bar
          dataKey="count"
          fill="url(#barGradient)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
