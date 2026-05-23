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
import {
  Mail,
  CheckCircle,
  Eye,
  MousePointer,
  AlertCircle,
} from "lucide-react";
import { useApiKey } from "@/hooks/useApiKey";

interface EmailMetric {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
}

interface EmailCampaignStatsProps {
  campaignId: string;
}

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export function EmailCampaignStats({ campaignId }: EmailCampaignStatsProps) {
  const [metrics, setMetrics] = useState<EmailMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const apiKey = useApiKey();

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/v1/email-campaigns/${campaignId}/metrics`,
        { headers: { "x-api-key": apiKey } },
      );
      if (!response.ok) throw new Error("Failed to fetch metrics");
      const data = await response.json();
      setMetrics((data.metrics || []).reverse());
    } catch {
      // metrics unavailable — show empty state
    } finally {
      setLoading(false);
    }
  }, [campaignId, apiKey]);

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }
    fetchMetrics();
  }, [apiKey, fetchMetrics]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>No metrics yet. Send the campaign to start collecting data.</p>
      </div>
    );
  }

  const totalStats = metrics.reduce(
    (acc, m) => ({
      sent: acc.sent + m.sent,
      delivered: acc.delivered + m.delivered,
      opened: acc.opened + m.opened,
      clicked: acc.clicked + m.clicked,
      bounced: acc.bounced + m.bounced,
      complained: acc.complained + m.complained,
    }),
    { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 },
  );

  const deliveryRate =
    totalStats.sent > 0
      ? ((totalStats.delivered / totalStats.sent) * 100).toFixed(1)
      : 0;

  const openRate =
    totalStats.delivered > 0
      ? ((totalStats.opened / totalStats.delivered) * 100).toFixed(1)
      : 0;

  const clickRate =
    totalStats.delivered > 0
      ? ((totalStats.clicked / totalStats.delivered) * 100).toFixed(1)
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
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
              Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-2xl font-bold">
                {totalStats.bounced + totalStats.complained}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Opened
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-purple-600" />
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
              Clicked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <MousePointer className="h-4 w-4 text-orange-600" />
              <span className="text-2xl font-bold">{totalStats.clicked}</span>
              <span className="text-sm text-muted-foreground">
                ({clickRate}%)
              </span>
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
                dataKey="clicked"
                stroke="#f59e0b"
                name="Clicked"
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
              <Bar dataKey="opened" fill="#8b5cf6" name="Opened" />
              <Bar dataKey="clicked" fill="#f59e0b" name="Clicked" />
              <Bar dataKey="bounced" fill="#ef4444" name="Bounced" />
              <Bar dataKey="complained" fill="#dc2626" name="Complained" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
