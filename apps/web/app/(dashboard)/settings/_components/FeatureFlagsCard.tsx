"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useApiKey } from "@/hooks/useApiKey";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface FeatureFlag {
  flag: string;
  tenantOverride: string | null;
  global: string | null;
  effective: string | null;
}

const FLAG_META: Record<string, { label: string; description: string }> = {
  ai_engagement_decisions: {
    label: "AI Engagement Decisions",
    description: "Use AI to select channel, timing, and copy variants",
  },
  voice_campaigns: {
    label: "Voice Campaigns",
    description: "Enable Twilio voice call campaigns with TTS",
  },
  whatsapp_channel: {
    label: "WhatsApp Channel",
    description: "Enable WhatsApp message delivery",
  },
  analytics_v2: {
    label: "Analytics v2",
    description: "Enhanced analytics with AI performance metrics",
  },
  event_replay: {
    label: "Event Replay",
    description: "Replay historical events through the processing pipeline",
  },
};

export function FeatureFlagsCard() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const apiKey = useApiKey();

  useEffect(() => {
    if (!apiKey) return;
    fetch(`${API_URL}/admin/feature-flags`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: FeatureFlag[]) => setFlags(data))
      .catch(() => setFlags([]))
      .finally(() => setLoading(false));
  }, [apiKey]);

  const handleToggle = async (
    flag: string,
    currentEffective: string | null,
  ) => {
    const enable = currentEffective !== "1";
    setToggling(flag);
    try {
      const res = await fetch(`${API_URL}/admin/feature-flags/${flag}`, {
        method: "PUT",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ enabled: enable, scope: "tenant" }),
      });
      if (res.ok) {
        setFlags((prev) =>
          prev.map((f) =>
            f.flag === flag
              ? {
                  ...f,
                  tenantOverride: enable ? "1" : null,
                  effective: enable ? "1" : null,
                }
              : f,
          ),
        );
      }
    } catch {
      // ignore
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Flags</CardTitle>
        <CardDescription>
          Toggle features for this tenant. Changes apply immediately.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {flags.map((flag, idx) => {
            const meta = FLAG_META[flag.flag] ?? {
              label: flag.flag,
              description: "",
            };
            const isEnabled = flag.effective === "1";
            return (
              <div key={flag.flag}>
                <div className="py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{meta.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {meta.description}
                    </div>
                    {flag.tenantOverride !== null && (
                      <Badge variant="outline" className="text-xs mt-1">
                        tenant override
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      variant={isEnabled ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <Button
                      variant={isEnabled ? "outline" : "default"}
                      size="sm"
                      onClick={() => handleToggle(flag.flag, flag.effective)}
                      disabled={toggling === flag.flag}
                    >
                      {toggling === flag.flag
                        ? "..."
                        : isEnabled
                          ? "Disable"
                          : "Enable"}
                    </Button>
                  </div>
                </div>
                {idx < flags.length - 1 && <Separator />}
              </div>
            );
          })}
          {flags.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No feature flags available.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
