"use client";

import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChannelData {
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

export function ChannelBreakdown() {
  const [data, setData] = useState<ChannelData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/v1/analytics/channels`, {})
      .then((res) => (res.ok ? res.json() : []))
      .then((d: ChannelData[]) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const byChannel = data.reduce<
    Record<string, { sent: number; delivered: number }>
  >((acc, item) => {
    const entry = acc[item.channel] ?? { sent: 0, delivered: 0 };
    if (item.status === "sent" || item.status === "delivered") {
      entry.sent += item._count;
    }
    if (item.status === "delivered") {
      entry.delivered += item._count;
    }
    acc[item.channel] = entry;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Channels (7 days)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="h-2 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : Object.keys(byChannel).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No data yet
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(byChannel).map(([channel, { sent, delivered }]) => {
              const rate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
              return (
                <div key={channel}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>
                      {CHANNEL_EMOJIS[channel] ?? "📨"} {channel}
                    </span>
                    <span className="text-muted-foreground">{rate}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sent} sent
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
