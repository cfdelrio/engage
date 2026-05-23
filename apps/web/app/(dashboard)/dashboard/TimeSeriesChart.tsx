"use client";

import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TimeSeriesChartView,
  type TimeSeriesPoint,
} from "./TimeSeriesChartView";

interface TimeSeriesResponse {
  windowDays: number;
  series: TimeSeriesPoint[];
}

export function TimeSeriesChart() {
  const [data, setData] = useState<TimeSeriesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/v1/analytics/timeseries?windowDays=7`, {})
      .then((res) => (res.ok ? res.json() : null))
      .then((d: TimeSeriesResponse | null) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Deliveries by channel (7 days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 bg-muted rounded animate-pulse" />
        ) : data === null ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No data available
          </p>
        ) : (
          <TimeSeriesChartView series={data.series} />
        )}
      </CardContent>
    </Card>
  );
}
