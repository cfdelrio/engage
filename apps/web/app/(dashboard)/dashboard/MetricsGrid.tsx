"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Users, Zap, TrendingUp } from "lucide-react";
import { useApiKey } from "@/hooks/useApiKey";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface OverviewData {
  totalDeliveries: number;
  totalUsers: number;
  recentEvents: number;
  deliveryByStatus: { status: string; _count: number }[];
}

export function MetricsGrid() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const apiKey = useApiKey();

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/v1/analytics/overview`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: OverviewData | null) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6 animate-pulse">
            <div className="h-4 w-24 bg-muted rounded mb-4" />
            <div className="h-8 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  const delivered =
    data?.deliveryByStatus.find((d) => d.status === "delivered")?._count ?? 0;
  const deliveryRate =
    data && data.totalDeliveries > 0
      ? Math.round((delivered / data.totalDeliveries) * 100)
      : 0;

  const metrics = [
    {
      title: "Total Users",
      value: data?.totalUsers?.toLocaleString() ?? "–",
      icon: Users,
      description: "Registered",
    },
    {
      title: "Events (30d)",
      value: data?.recentEvents?.toLocaleString() ?? "–",
      icon: Zap,
      description: "Processed",
    },
    {
      title: "Deliveries",
      value: data?.totalDeliveries?.toLocaleString() ?? "–",
      icon: Send,
      description: "Total sent",
    },
    {
      title: "Delivery Rate",
      value: `${deliveryRate}%`,
      icon: TrendingUp,
      description: "Last 30 days",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map(({ title, value, icon: Icon, description }) => (
        <Card key={title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
