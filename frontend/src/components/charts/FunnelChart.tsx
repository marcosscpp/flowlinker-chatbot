import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { FunnelStage } from "../../api/types";

interface FunnelChartProps {
  data: FunnelStage[];
}

const COLORS = [
  "#a855f7", // primary-500
  "#8b5cf6", // violet-500
  "#6366f1", // indigo-500
  "#3b82f6", // blue-500
  "#22c55e", // green-500
];

export function FunnelChart({ data }: FunnelChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          stroke="var(--border-color)"
        />
        <XAxis
          type="number"
          tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
          axisLine={{ stroke: "var(--border-color)" }}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          width={90}
          axisLine={{ stroke: "var(--border-color)" }}
        />
        <Tooltip
          formatter={(value: number, _name: string, props: any) => [
            `${value} (${props.payload.percentage.toFixed(1)}%)`,
            "Leads",
          ]}
          contentStyle={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            color: "var(--text-primary)",
          }}
        />
        <Bar dataKey="count" radius={[0, 8, 8, 0]}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
