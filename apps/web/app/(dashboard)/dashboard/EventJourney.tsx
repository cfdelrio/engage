"use client";

import { apiFetch } from "@/lib/api-client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  GitBranch,
  Radio,
  Send,
  Zap,
} from "lucide-react";

interface OverviewData {
  totalDeliveries: number;
  recentEvents: number;
  deliveryByStatus: { status: string; _count: number }[];
}

interface JourneyStep {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  value: string | null;
  status: "active" | "idle" | "loading";
}

export function EventJourney() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/v1/analytics/overview`, {})
      .then((res) => (res.ok ? res.json() : null))
      .then((d: OverviewData | null) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const delivered =
    data?.deliveryByStatus.find((d) => d.status === "delivered")?._count ?? 0;
  const failed =
    data?.deliveryByStatus.find(
      (d) => d.status === "failed" || d.status === "error",
    )?._count ?? 0;
  const deliveryRate =
    data && data.totalDeliveries > 0
      ? Math.round((delivered / data.totalDeliveries) * 100)
      : null;

  const steps: JourneyStep[] = [
    {
      id: "event",
      label: "Evento",
      sublabel: "Ingresa al sistema",
      icon: Zap,
      iconBg: "bg-violet-500/15",
      iconColor: "text-violet-500",
      value: loading ? null : (data?.recentEvents?.toLocaleString("es") ?? "0"),
      status: loading ? "loading" : data ? "active" : "idle",
    },
    {
      id: "rule",
      label: "Regla",
      sublabel: "Evaluación IF/THEN",
      icon: GitBranch,
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-500",
      value: null,
      status: loading ? "loading" : "active",
    },
    {
      id: "ai",
      label: "AI",
      sublabel: "Decisión inteligente",
      icon: Bot,
      iconBg: "bg-pink-500/15",
      iconColor: "text-pink-500",
      value: null,
      status: loading ? "loading" : "active",
    },
    {
      id: "channel",
      label: "Canal",
      sublabel: "Email · SMS · Push",
      icon: Radio,
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-500",
      value: loading
        ? null
        : (data?.totalDeliveries?.toLocaleString("es") ?? "0"),
      status: loading ? "loading" : data ? "active" : "idle",
    },
    {
      id: "delivery",
      label: "Entrega",
      sublabel: "Resultado final",
      icon: Send,
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-500",
      value: loading ? null : delivered.toLocaleString("es"),
      status: loading ? "loading" : data ? "active" : "idle",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[13px] font-semibold">Event Journey</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Flujo de eventos: captura → decisión → entrega
          </p>
        </div>
        {deliveryRate !== null && (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="text-[13px] font-semibold tabular-nums">
              {deliveryRate}% entregado
            </span>
          </div>
        )}
      </div>

      {/* Journey steps */}
      <div className="flex items-center gap-0">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center flex-1">
            {/* Step card */}
            <div
              className="flex-1 animate-slide-up"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="rounded-lg border border-border bg-background/60 p-3.5 hover:border-border/80 hover:bg-muted/20 transition-all duration-200 h-full">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${step.iconBg}`}
                  >
                    <step.icon className={`h-3.5 w-3.5 ${step.iconColor}`} />
                  </div>
                  {step.status === "active" && (
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-live-pulse shrink-0" />
                  )}
                </div>
                <p className="text-[13px] font-semibold text-foreground leading-tight">
                  {step.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                  {step.sublabel}
                </p>
                {step.value !== null && (
                  <p
                    className={`mt-2 text-lg font-bold tabular-nums tracking-tight ${step.iconColor} animate-count-in`}
                  >
                    {step.value}
                  </p>
                )}
                {step.status === "loading" && (
                  <div className="mt-2 h-5 w-12 bg-muted rounded animate-pulse" />
                )}
              </div>
            </div>

            {/* Arrow connector */}
            {i < steps.length - 1 && (
              <div className="flex items-center justify-center w-6 shrink-0">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delivery breakdown bar */}
      {!loading && data && data.totalDeliveries > 0 && (
        <div className="mt-4 pt-4 border-t border-border/60">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
            <span>Tasa de entrega</span>
            <span className="flex items-center gap-3">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {delivered.toLocaleString("es")} entregados
              </span>
              {failed > 0 && (
                <span className="text-red-500 font-medium">
                  {failed.toLocaleString("es")} fallidos
                </span>
              )}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${deliveryRate ?? 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
