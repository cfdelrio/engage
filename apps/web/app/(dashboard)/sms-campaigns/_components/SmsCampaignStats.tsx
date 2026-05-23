"use client";

import { apiFetch } from "@/lib/api-client";

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
import { MessageSquare, CheckCircle, AlertCircle } from "lucide-react";

interface SmsMetric {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
}

interface SmsCampaignStatsProps {
  campaignId: string;
}

export function SmsCampaignStats({ campaignId }: SmsCampaignStatsProps) {
  const [metrics, setMetrics] = useState<SmsMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await apiFetch(
        `/v1/sms-campaigns/${campaignId}/metrics`,
      );
      if (!response.ok) throw new Error("Failed to fetch metrics");
      const data = await response.json();
      setMetrics((data.metrics || []).reverse());
    } catch {
      // metrics unavailable — show empty state
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

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
      failed: acc.failed + m.failed,
    }),
    { sent: 0, delivered: 0, failed: 0 },
  );

  const deliveryRate =
    totalStats.sent > 0
      ? ((totalStats.delivered / totalStats.sent) * 100).toFixed(1)
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
              <MessageSquare className="h-4 w-4 text-blue-600" />
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
          <CardTitle>Delivery Status</CardTitle>
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
              <Bar dataKey="failed" fill="#ef4444" name="Failed" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
