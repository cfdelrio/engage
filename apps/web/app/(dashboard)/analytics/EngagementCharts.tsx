"use client";

import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChannelMetric {
  channel: string;
  status: string;
  _count: number;
}

const CHANNEL_EMOJIS: Record<string, string> = {
  email: "📧",
  sms: "💬",
  push: "🔔",
  whatsapp: "💚",
  voice: "📞",
  in_app: "📱",
};

export function EngagementCharts() {
  const [data, setData] = useState<ChannelMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/v1/analytics/channels`, {})
      .then((res) => (res.ok ? res.json() : []))
      .then((d: ChannelMetric[]) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const byChannel = data.reduce<Record<string, Record<string, number>>>(
    (acc, item) => {
      const channelData = acc[item.channel] ?? {};
      acc[item.channel] = { ...channelData, [item.status]: item._count };
      return acc;
    },
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Channel Performance (7d)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((j) => (
                    <div
                      key={j}
                      className="h-12 bg-muted rounded animate-pulse"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : Object.keys(byChannel).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No data available
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(byChannel).map(([channel, stats]) => {
              const sent = (stats["sent"] ?? 0) + (stats["delivered"] ?? 0);
              const delivered = stats["delivered"] ?? 0;
              const opened = stats["opened"] ?? 0;
              const failed = stats["failed"] ?? 0;

              return (
                <div key={channel} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {CHANNEL_EMOJIS[channel] ?? "📨"} {channel.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: "Sent", value: sent, color: "text-blue-600" },
                      {
                        label: "Delivered",
                        value: delivered,
                        color: "text-green-600",
                      },
                      {
                        label: "Opened",
                        value: opened,
                        color: "text-purple-600",
                      },
                      { label: "Failed", value: failed, color: "text-red-600" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-muted rounded p-2">
                        <p className={`text-lg font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
