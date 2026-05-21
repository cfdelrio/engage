import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TimeSeriesChartView,
  type TimeSeriesPoint,
} from "./TimeSeriesChartView";

const API_URL =
  process.env["INTERNAL_API_URL"] ??
  process.env["NEXT_PUBLIC_API_URL"] ??
  "http://localhost:3001";
const API_KEY = process.env["INTERNAL_API_KEY"] ?? "";

interface TimeSeriesResponse {
  windowDays: number;
  series: TimeSeriesPoint[];
}

async function getTimeSeries(): Promise<TimeSeriesResponse | null> {
  try {
    const res = await fetch(`${API_URL}/v1/analytics/timeseries?windowDays=7`, {
      headers: { "x-api-key": API_KEY },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as TimeSeriesResponse;
  } catch {
    return null;
  }
}

export async function TimeSeriesChart() {
  const data = await getTimeSeries();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Deliveries por canal (7 días)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data === null ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No se pudo cargar la serie temporal
          </p>
        ) : (
          <TimeSeriesChartView series={data.series} />
        )}
      </CardContent>
    </Card>
  );
}
