"use client";

import { apiFetch } from "@/lib/api-client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import dynamic from "next/dynamic";

const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), {
  ssr: false,
});
const Line = dynamic(() => import("recharts").then((m) => m.Line), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), {
  ssr: false,
});
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false },
);
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), {
  ssr: false,
});
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), {
  ssr: false,
});
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false },
);

interface TimeSeriesDataPoint {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
}

interface TimeSeriesChartProps {
  dateRange: { from: Date; to: Date };
}

export function TimeSeriesChart({ dateRange }: TimeSeriesChartProps) {
  const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    });

    apiFetch(`/v1/analytics/timeseries?${params}`, {})
      .then((res) => (res.ok ? res.json() : []))
      .then((d: TimeSeriesDataPoint[]) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [dateRange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement Timeline</CardTitle>
        <CardDescription>
          Messages sent, delivered, opened, and clicked over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-96 bg-muted rounded animate-pulse" />
        ) : data.length === 0 ? (
          <div className="h-96 flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        ) : (
          <div className="w-full h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sent"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Sent"
                />
                <Line
                  type="monotone"
                  dataKey="delivered"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Delivered"
                />
                <Line
                  type="monotone"
                  dataKey="opened"
                  stroke="#a855f7"
                  strokeWidth={2}
                  name="Opened"
                />
                <Line
                  type="monotone"
                  dataKey="clicked"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Clicked"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
