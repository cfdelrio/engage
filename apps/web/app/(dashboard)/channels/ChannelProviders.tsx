"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useApiKey } from "@/hooks/useApiKey";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface Provider {
  id: string;
  channel: string;
  provider: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

const CHANNEL_ICONS: Record<string, string> = {
  email: "✉️",
  sms: "📱",
  push: "🔔",
  whatsapp: "💬",
  voice: "☎️",
};

export function ChannelProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const apiKey = useApiKey();

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    fetch(`${API_URL}/v1/providers`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Provider[] | null) => {
        if (cancelled) return;
        if (data) {
          setProviders(data);
        } else {
          setProviders([]);
        }
      })
      .catch(() => {
        if (!cancelled) setProviders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  const handleToggleActive = async (providerId: string, newActive: boolean) => {
    try {
      const res = await fetch(`${API_URL}/v1/providers/${providerId}`, {
        method: "PUT",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ isActive: newActive }),
      });

      if (res.ok) {
        const updated = await res.json();
        setProviders((prev) =>
          prev.map((p) => (p.id === providerId ? updated : p)),
        );
      }
    } catch {
      // ignore
    }
  };

  const handleSetDefault = async (providerId: string) => {
    try {
      const res = await fetch(`${API_URL}/v1/providers/${providerId}`, {
        method: "PUT",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ isDefault: true }),
      });

      if (res.ok) {
        const updated = await res.json();
        const channel = updated.channel;
        setProviders((prev) =>
          prev.map((p) =>
            p.channel === channel
              ? { ...p, isDefault: p.id === providerId }
              : p,
          ),
        );
      }
    } catch {
      // ignore
    }
  };

  const channels = ["email", "sms", "push", "whatsapp", "voice"];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configured channels</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {channels.map((channel) => {
              const channelProviders = providers.filter(
                (p) => p.channel === channel,
              );
              const isExpanded = expandedChannel === channel;

              return (
                <div
                  key={channel}
                  className="border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedChannel(isExpanded ? null : channel)
                    }
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left"
                  >
                    <span className="text-2xl">
                      {CHANNEL_ICONS[channel] || "📌"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium capitalize">{channel}</div>
                      <div className="text-xs text-muted-foreground">
                        {channelProviders.length === 0
                          ? "No providers configured"
                          : `${channelProviders.length} provider${
                              channelProviders.length > 1 ? "s" : ""
                            }`}
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="border-t bg-muted/30 p-4 space-y-3">
                      {channelProviders.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No providers configured for {channel}
                        </p>
                      ) : (
                        <>
                          {channelProviders.map((provider) => (
                            <div
                              key={provider.id}
                              className="flex items-center justify-between p-3 bg-background rounded border"
                            >
                              <div className="flex-1">
                                <div className="font-medium capitalize text-sm">
                                  {provider.provider}
                                </div>
                                <div className="flex gap-2 mt-1">
                                  {provider.isDefault && (
                                    <Badge
                                      variant="default"
                                      className="text-xs"
                                    >
                                      Default
                                    </Badge>
                                  )}
                                  <Badge
                                    variant={
                                      provider.isActive ? "default" : "outline"
                                    }
                                    className="text-xs"
                                  >
                                    {provider.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {!provider.isDefault && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleSetDefault(provider.id)
                                    }
                                  >
                                    Set Default
                                  </Button>
                                )}
                                <Button
                                  variant={
                                    provider.isActive ? "default" : "outline"
                                  }
                                  size="sm"
                                  onClick={() =>
                                    handleToggleActive(
                                      provider.id,
                                      !provider.isActive,
                                    )
                                  }
                                >
                                  {provider.isActive ? "Disable" : "Enable"}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      <div className="pt-3 border-t">
                        <Button size="sm" variant="outline" className="w-full">
                          + Add {channel} provider
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
