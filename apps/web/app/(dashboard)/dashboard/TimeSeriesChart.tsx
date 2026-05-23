"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiKey } from "@/hooks/useApiKey";
import {
  TimeSeriesChartView,
  type TimeSeriesPoint,
} from "./TimeSeriesChartView";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface TimeSeriesResponse {
  windowDays: number;
  series: TimeSeriesPoint[];
}

export function TimeSeriesChart() {
  const [data, setData] = useState<TimeSeriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const apiKey = useApiKey();

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/v1/analytics/timeseries?windowDays=7`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: TimeSeriesResponse | null) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiKey]);

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
