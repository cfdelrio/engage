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
import { ArrowUpRight } from "lucide-react";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface CampaignMetric {
  id: string;
  name: string;
  type: string;
  status: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  createdAt: string;
}

interface CampaignPerformanceProps {
  dateRange: { from: Date; to: Date };
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
  draft: "bg-gray-100 text-gray-800",
};

export function CampaignPerformance({ dateRange }: CampaignPerformanceProps) {
  const [data, setData] = useState<CampaignMetric[]>([]);
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

    fetch(`${API_URL}/v1/analytics/campaigns?${params}`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((d: CampaignMetric[]) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [apiKey, dateRange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Performance</CardTitle>
        <CardDescription>
          Detailed metrics for all campaigns in selected period
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No campaigns in selected period
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs font-medium">
                  <th className="text-left py-2 px-3">Campaign</th>
                  <th className="text-right py-2 px-3">Sent</th>
                  <th className="text-right py-2 px-3">Delivered</th>
                  <th className="text-right py-2 px-3">Delivery Rate</th>
                  <th className="text-right py-2 px-3">Open Rate</th>
                  <th className="text-right py-2 px-3">Click Rate</th>
                  <th className="text-right py-2 px-3">Conversion Rate</th>
                  <th className="text-center py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((campaign) => (
                  <tr
                    key={campaign.id}
                    className="border-b hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div>
                        <p className="font-medium truncate">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {campaign.type}
                        </p>
                      </div>
                    </td>
                    <td className="text-right py-3 px-3 font-mono text-sm">
                      {campaign.sent.toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-3 font-mono text-sm">
                      {campaign.delivered.toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-3">
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-semibold">
                          {Math.round(campaign.deliveryRate * 100)}%
                        </span>
                        {campaign.deliveryRate > 0.9 && (
                          <ArrowUpRight className="h-3 w-3 text-green-600" />
                        )}
                      </div>
                    </td>
                    <td className="text-right py-3 px-3 font-semibold">
                      {Math.round(campaign.openRate * 100)}%
                    </td>
                    <td className="text-right py-3 px-3 font-semibold">
                      {Math.round(campaign.clickRate * 100)}%
                    </td>
                    <td className="text-right py-3 px-3 font-semibold">
                      {Math.round(campaign.conversionRate * 100)}%
                    </td>
                    <td className="text-center py-3 px-3">
                      <Badge
                        className={
                          STATUS_COLORS[campaign.status] ??
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {campaign.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
