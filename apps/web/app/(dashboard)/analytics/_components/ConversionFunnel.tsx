"use client";

import { apiFetch } from "@/lib/api-client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChannelMetric {
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
}

interface ConversionFunnelProps {
  dateRange: { from: Date; to: Date };
}

const CHANNEL_COLORS: Record<string, string> = {
  email: "bg-blue-500",
  sms: "bg-green-500",
  push: "bg-purple-500",
  whatsapp: "bg-emerald-500",
  voice: "bg-orange-500",
};

const STAGE_LABELS = ["Sent", "Delivered", "Opened", "Clicked"];

export function ConversionFunnel({ dateRange }: ConversionFunnelProps) {
  const [data, setData] = useState<ChannelMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    });

    apiFetch(`/v1/analytics/channels-detailed?${params}`, {})
      .then((res: Response) => (res.ok ? res.json() : []))
      .then((d: ChannelMetric[]) => {
        setData(d);
        if (d.length > 0 && !selected) setSelected(d[0]?.channel ?? null);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [dateRange]);

  const active = data.find((d) => d.channel === selected) ?? data[0];

  const stages = active
    ? [
        { label: "Sent", value: active.sent, pct: 100 },
        {
          label: "Delivered",
          value: active.delivered,
          pct: active.sent > 0 ? (active.delivered / active.sent) * 100 : 0,
        },
        {
          label: "Opened",
          value: active.opened,
          pct: active.sent > 0 ? (active.opened / active.sent) * 100 : 0,
        },
        {
          label: "Clicked",
          value: active.clicked,
          pct: active.sent > 0 ? (active.clicked / active.sent) * 100 : 0,
        },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No data in selected period
          </div>
        ) : (
          <div className="space-y-6">
            {/* Channel selector */}
            <div className="flex gap-2 flex-wrap">
              {data.map((d) => (
                <button
                  key={d.channel}
                  onClick={() => setSelected(d.channel)}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors border ${
                    selected === d.channel
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-muted-foreground border-border hover:border-foreground"
                  }`}
                >
                  {d.channel}
                </button>
              ))}
            </div>

            {/* Funnel bars */}
            {active && (
              <div className="space-y-3">
                {stages.map((stage, i) => {
                  const color = CHANNEL_COLORS[active.channel] ?? "bg-gray-500";
                  const dropoff =
                    i > 0 ? (stages[i - 1]?.value ?? 0) - stage.value : 0;
                  return (
                    <div key={stage.label}>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span className="font-medium">{STAGE_LABELS[i]}</span>
                        <span>
                          {stage.value.toLocaleString()}
                          <span className="ml-2 text-muted-foreground/60">
                            ({stage.pct.toFixed(1)}%)
                          </span>
                          {dropoff > 0 && (
                            <span className="ml-2 text-red-500">
                              −{dropoff.toLocaleString()}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-8 bg-muted rounded overflow-hidden">
                        <div
                          className={`h-full ${color} rounded transition-all duration-500`}
                          style={{ width: `${Math.max(stage.pct, 0.5)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Rate summary */}
            {active && (
              <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Delivery Rate</p>
                  <p className="text-lg font-bold">
                    {(active.deliveryRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Open Rate</p>
                  <p className="text-lg font-bold">
                    {(active.openRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Click Rate</p>
                  <p className="text-lg font-bold">
                    {(active.clickRate * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
