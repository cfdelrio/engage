"use client";

import { apiFetch } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { Send, TrendingUp, Users, Zap } from "lucide-react";

interface OverviewData {
  totalDeliveries: number;
  totalUsers: number;
  recentEvents: number;
  deliveryByStatus: { status: string; _count: number }[];
}

interface MetricCard {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  trend?: { value: number; label: string };
}

function MetricCardSkeleton({ delay }: { delay: string }) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-5 animate-slide-up"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="h-3.5 w-24 bg-muted rounded animate-pulse" />
        <div className="h-8 w-8 bg-muted rounded-lg animate-pulse" />
      </div>
      <div className="h-8 w-20 bg-muted rounded animate-pulse mb-1.5" />
      <div className="h-3 w-28 bg-muted rounded animate-pulse" />
    </div>
  );
}

export function MetricsGrid() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/v1/analytics/overview`, {})
      .then((res) => (res.ok ? res.json() : null))
      .then((d: OverviewData | null) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {["0s", "0.05s", "0.10s", "0.15s"].map((delay, i) => (
          <MetricCardSkeleton key={i} delay={delay} />
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

  const metrics: MetricCard[] = [
    {
      title: "Total Users",
      value: data?.totalUsers?.toLocaleString("es") ?? "—",
      description: "Usuarios registrados",
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Events (30d)",
      value: data?.recentEvents?.toLocaleString("es") ?? "—",
      description: "Eventos procesados",
      icon: Zap,
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
    },
    {
      title: "Deliveries",
      value: data?.totalDeliveries?.toLocaleString("es") ?? "—",
      description: "Mensajes enviados",
      icon: Send,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Delivery Rate",
      value: `${deliveryRate}%`,
      description: "Últimos 30 días",
      icon: TrendingUp,
      color:
        deliveryRate >= 80
          ? "text-emerald-500"
          : deliveryRate >= 60
            ? "text-amber-500"
            : "text-red-500",
      bgColor:
        deliveryRate >= 80
          ? "bg-emerald-500/10"
          : deliveryRate >= 60
            ? "bg-amber-500/10"
            : "bg-red-500/10",
    },
  ];

  const delays = ["0s", "0.05s", "0.1s", "0.15s"];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map(
        ({ title, value, description, icon: Icon, color, bgColor }, i) => (
          <div
            key={title}
            className="rounded-xl border border-border bg-card p-5 hover:border-border/80 hover:shadow-sm transition-all duration-200 animate-slide-up group"
            style={{ animationDelay: delays[i] }}
          >
            <div className="flex items-start justify-between mb-4">
              <p className="text-[13px] font-medium text-muted-foreground">
                {title}
              </p>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgColor} transition-transform duration-200 group-hover:scale-110`}
              >
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground animate-count-in">
              {value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        ),
      )}
    </div>
  );
}
