"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Bell, CheckCircle, AlertCircle } from "lucide-react";
import { useApiKey } from "@/hooks/useApiKey";

interface PushMetric {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  failed: number;
}

interface PushCampaignStatsProps {
  campaignId: string;
}

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export function PushCampaignStats({ campaignId }: PushCampaignStatsProps) {
  const [metrics, setMetrics] = useState<PushMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const apiKey = useApiKey();

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/v1/push-campaigns/${campaignId}/metrics`,
        { headers: { "x-api-key": apiKey } },
      );
      if (!response.ok) throw new Error("Failed to fetch metrics");
      const data = await response.json();
      setMetrics((data.metrics || []).reverse());
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
    } finally {
      setLoading(false);
    }
  }, [campaignId, apiKey]);

  useEffect(() => {
    if (!apiKey) return;
    fetchMetrics();
  }, [apiKey, fetchMetrics]);

  if (loading) return <div className="p-4">Loading metrics...</div>;
  if (metrics.length === 0)
    return <div className="p-4 text-muted-foreground">No metrics yet</div>;

  const totalStats = metrics.reduce(
    (acc, m) => ({
      sent: acc.sent + m.sent,
      delivered: acc.delivered + m.delivered,
      opened: acc.opened + m.opened,
      failed: acc.failed + m.failed,
    }),
    { sent: 0, delivered: 0, opened: 0, failed: 0 },
  );

  const deliveryRate =
    totalStats.sent > 0
      ? ((totalStats.delivered / totalStats.sent) * 100).toFixed(1)
      : 0;

  const openRate =
    totalStats.delivered > 0
      ? ((totalStats.opened / totalStats.delivered) * 100).toFixed(1)
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-600" />
              <span className="text-2xl font-bold">{totalStats.sent}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Delivered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-2xl font-bold">{totalStats.delivered}</span>
              <span className="text-sm text-muted-foreground">
                ({deliveryRate}%)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Opened
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-purple-600" />
              <span className="text-2xl font-bold">{totalStats.opened}</span>
              <span className="text-sm text-muted-foreground">
                ({openRate}%)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-2xl font-bold">{totalStats.failed}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="sent"
                stroke="#3b82f6"
                name="Sent"
              />
              <Line
                type="monotone"
                dataKey="delivered"
                stroke="#10b981"
                name="Delivered"
              />
              <Line
                type="monotone"
                dataKey="opened"
                stroke="#8b5cf6"
                name="Opened"
              />
              <Line
                type="monotone"
                dataKey="failed"
                stroke="#ef4444"
                name="Failed"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Engagement Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sent" fill="#3b82f6" name="Sent" />
              <Bar dataKey="delivered" fill="#10b981" name="Delivered" />
              <Bar dataKey="opened" fill="#8b5cf6" name="Opened" />
              <Bar dataKey="failed" fill="#ef4444" name="Failed" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
