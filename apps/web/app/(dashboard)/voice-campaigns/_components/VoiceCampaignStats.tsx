"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Phone, CheckCircle, AlertCircle } from "lucide-react";
import { useApiKey } from "@/hooks/useApiKey";

interface VoiceMetric {
  date: string;
  calls_sent: number;
  calls_answered: number;
  calls_completed: number;
  calls_failed: number;
  avg_duration: number;
}

interface VoiceCampaignStatsProps {
  campaignId: string;
}

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

const SENTIMENT_COLORS = {
  positive: "#10b981",
  neutral: "#6b7280",
  negative: "#ef4444",
};

export function VoiceCampaignStats({ campaignId }: VoiceCampaignStatsProps) {
  const [metrics, setMetrics] = useState<VoiceMetric[]>([]);
  const [sentimentData, setSentimentData] = useState<
    { name: string; value: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const apiKey = useApiKey();

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/v1/voice-campaigns/${campaignId}/metrics`,
        { headers: { "x-api-key": apiKey } },
      );
      if (!response.ok) throw new Error("Failed to fetch metrics");
      const data = await response.json();
      const metricsData = (data.metrics || []).reverse();
      setMetrics(metricsData);

      // Prepare sentiment data if available
      if (data.sentiment) {
        setSentimentData([
          { name: "Positive", value: data.sentiment.positive || 0 },
          { name: "Neutral", value: data.sentiment.neutral || 0 },
          { name: "Negative", value: data.sentiment.negative || 0 },
        ]);
      }
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
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

  if (loading) return <div className="p-4">Loading metrics...</div>;
  if (metrics.length === 0)
    return <div className="p-4 text-muted-foreground">No metrics yet</div>;

  const totalStats = metrics.reduce(
    (acc, m) => ({
      sent: acc.sent + m.calls_sent,
      answered: acc.answered + m.calls_answered,
      completed: acc.completed + m.calls_completed,
      failed: acc.failed + m.calls_failed,
      avgDuration:
        acc.avgDuration +
        (m.avg_duration * m.calls_completed) / Math.max(m.calls_completed, 1),
    }),
    { sent: 0, answered: 0, completed: 0, failed: 0, avgDuration: 0 },
  );

  const answerRate =
    totalStats.sent > 0
      ? ((totalStats.answered / totalStats.sent) * 100).toFixed(1)
      : 0;

  const completionRate =
    totalStats.answered > 0
      ? ((totalStats.completed / totalStats.answered) * 100).toFixed(1)
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Calls Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-blue-600" />
              <span className="text-2xl font-bold">{totalStats.sent}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Answered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-2xl font-bold">{totalStats.answered}</span>
              <span className="text-sm text-muted-foreground">
                ({answerRate}%)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-purple-600" />
              <span className="text-2xl font-bold">{totalStats.completed}</span>
              <span className="text-sm text-muted-foreground">
                ({completionRate}%)
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
                dataKey="calls_sent"
                stroke="#3b82f6"
                name="Sent"
              />
              <Line
                type="monotone"
                dataKey="calls_answered"
                stroke="#10b981"
                name="Answered"
              />
              <Line
                type="monotone"
                dataKey="calls_completed"
                stroke="#8b5cf6"
                name="Completed"
              />
              <Line
                type="monotone"
                dataKey="calls_failed"
                stroke="#ef4444"
                name="Failed"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Call Metrics</CardTitle>
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
              <Bar dataKey="calls_sent" fill="#3b82f6" name="Sent" />
              <Bar dataKey="calls_answered" fill="#10b981" name="Answered" />
              <Bar dataKey="calls_completed" fill="#8b5cf6" name="Completed" />
              <Bar dataKey="calls_failed" fill="#ef4444" name="Failed" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {sentimentData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill={SENTIMENT_COLORS.positive} />
                  <Cell fill={SENTIMENT_COLORS.neutral} />
                  <Cell fill={SENTIMENT_COLORS.negative} />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
