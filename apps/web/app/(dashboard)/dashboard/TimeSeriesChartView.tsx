"use client";

import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface TimeSeriesPoint {
  date: string;
  email: number;
  sms: number;
  push: number;
  whatsapp: number;
  voice: number;
}

const CHANNEL_COLORS: Record<keyof Omit<TimeSeriesPoint, "date">, string> = {
  email: "#3b82f6",
  sms: "#10b981",
  push: "#a855f7",
  whatsapp: "#059669",
  voice: "#f97316",
};

function formatTickDate(value: string): string {
  // Drop the year and force short month/day in the chart's X axis.
  const d = new Date(value);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function TimeSeriesChartView({ series }: { series: TimeSeriesPoint[] }) {
  if (series.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sin datos aún
      </p>
    );
  }

  const totalPoints = series.reduce(
    (sum, point) =>
      sum + point.email + point.sms + point.push + point.whatsapp + point.voice,
    0,
  );

  if (totalPoints === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sin deliveries en la ventana
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart
        data={series}
        margin={{ top: 5, right: 12, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tickFormatter={formatTickDate}
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <Tooltip
          labelFormatter={(value: string) =>
            new Date(value).toLocaleDateString("es-AR", {
              weekday: "short",
              day: "2-digit",
              month: "short",
            })
          }
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {(
          Object.keys(CHANNEL_COLORS) as Array<keyof typeof CHANNEL_COLORS>
        ).map((channel) => (
          <Line
            key={channel}
            type="monotone"
            dataKey={channel}
            stroke={CHANNEL_COLORS[channel]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
