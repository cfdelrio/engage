"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApiKey } from "@/hooks/useApiKey";
import dynamic from "next/dynamic";

const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), {
  ssr: false,
});
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), {
  ssr: false,
});
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false },
);
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), {
  ssr: false,
});
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), {
  ssr: false,
});
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false },
);

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

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

interface ChannelComparisonProps {
  dateRange: { from: Date; to: Date };
}

const CHANNEL_COLORS: Record<string, string> = {
  email: "bg-blue-100 text-blue-800",
  sms: "bg-green-100 text-green-800",
  push: "bg-purple-100 text-purple-800",
  whatsapp: "bg-emerald-100 text-emerald-800",
  voice: "bg-orange-100 text-orange-800",
};

export function ChannelComparison({ dateRange }: ChannelComparisonProps) {
  const [data, setData] = useState<ChannelMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const apiKey = useApiKey();

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    });

    fetch(`${API_URL}/v1/analytics/channels-detailed?${params}`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((d: ChannelMetric[]) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [apiKey, dateRange]);

  return (
    <div className="space-y-6">
      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Performance</CardTitle>
          <CardDescription>
            Delivery and engagement rates by channel
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-96 bg-muted rounded animate-pulse" />
          ) : data.length === 0 ? (
            <div className="h-96 flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          ) : (
            <div className="w-full h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sent" fill="#3b82f6" name="Sent" />
                  <Bar dataKey="delivered" fill="#10b981" name="Delivered" />
                  <Bar dataKey="opened" fill="#a855f7" name="Opened" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed metrics table */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Channel Metrics Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {data.map((metric) => (
                <div
                  key={metric.channel}
                  className="py-4 flex items-start justify-between gap-4"
                >
                  <div>
                    <Badge
                      className={
                        CHANNEL_COLORS[metric.channel] ??
                        "bg-gray-100 text-gray-800"
                      }
                    >
                      {metric.channel.toUpperCase()}
                    </Badge>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Sent</p>
                        <p className="font-semibold">
                          {metric.sent.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Delivery Rate
                        </p>
                        <p className="font-semibold">
                          {Math.round(metric.deliveryRate * 100)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Open Rate
                        </p>
                        <p className="font-semibold">
                          {Math.round(metric.openRate * 100)}%
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-xs">Click Rate</p>
                    <p className="text-lg font-semibold">
                      {Math.round(metric.clickRate * 100)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
