"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useApiKey } from "@/hooks/useApiKey";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface KPIData {
  totalSent: number;
  totalDelivered: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  avgEngagementScore: number;
  churnRate: number;
  previousPeriod?: {
    totalSent: number;
    deliveryRate: number;
    openRate: number;
  };
}

interface KPICardsProps {
  dateRange: { from: Date; to: Date };
}

export function KPICards({ dateRange }: KPICardsProps) {
  const [data, setData] = useState<KPIData | null>(null);
  const apiKey = useApiKey();

  useEffect(() => {
    if (!apiKey) return;

    const params = new URLSearchParams({
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    });

    fetch(`${API_URL}/v1/analytics/overview?${params}`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: KPIData | null) => setData(d))
      .catch(() => setData(null));
  }, [apiKey, dateRange]);

  const kpis = [
    {
      label: "Delivery Rate",
      value: data?.deliveryRate
        ? `${Math.round(data.deliveryRate * 100)}%`
        : "—",
      prev: data?.previousPeriod?.deliveryRate,
      unit: "%",
    },
    {
      label: "Open Rate",
      value: data?.openRate ? `${Math.round(data.openRate * 100)}%` : "—",
      prev: data?.previousPeriod?.openRate,
      unit: "%",
    },
    {
      label: "Click Rate",
      value: data?.clickRate ? `${Math.round(data.clickRate * 100)}%` : "—",
      prev: null,
      unit: "%",
    },
    {
      label: "Conversion Rate",
      value: data?.conversionRate
        ? `${Math.round(data.conversionRate * 100)}%`
        : "—",
      prev: null,
      unit: "%",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => {
        const trend =
          kpi.prev !== null && data?.previousPeriod
            ? ((parseFloat(kpi.value) - kpi.prev) / kpi.prev) * 100
            : null;

        return (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{kpi.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold">{kpi.value}</p>
                {trend !== null && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${trend > 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {trend > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {Math.abs(Math.round(trend))}%
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
