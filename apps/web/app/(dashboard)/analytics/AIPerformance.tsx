"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain } from "lucide-react";
import { useApiKey } from "@/hooks/useApiKey";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface AIStats {
  total: number;
  aiGenerated: number;
  aiAdoptionRate: number;
}

export function AIPerformance() {
  const [stats, setStats] = useState<AIStats | null>(null);
  const [loading, setLoading] = useState(true);
  const apiKey = useApiKey();

  useEffect(() => {
    if (!apiKey) return;
    fetch(`${API_URL}/v1/analytics/ai-performance`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: AIStats | null) => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiKey]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">AI Performance</CardTitle>
        <Brain className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-24 bg-muted rounded animate-pulse" />
              <div className="h-4 w-40 bg-muted rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : !stats ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No data available
          </p>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-5xl font-bold text-primary">
                {Math.round(stats.aiAdoptionRate * 100)}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                AI-assisted decisions
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">
                  {stats.total.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total decisions</p>
              </div>
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {stats.aiGenerated.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">AI decisions</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-xs">
                Provider-agnostic
              </Badge>
              <Badge variant="outline" className="text-xs">
                Auditable
              </Badge>
              <Badge variant="outline" className="text-xs">
                Guardrails
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
