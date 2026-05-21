"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, Play } from "lucide-react";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  channels: string[];
  createdAt: string;
  runs: Array<{ id: string; status: string }>;
}

interface CampaignsResponse {
  campaigns: Campaign[];
  nextCursor: string | null;
  hasMore: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  active: "default",
  paused: "outline",
  completed: "secondary",
};

export function CampaignsList() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const apiKey = localStorage.getItem("engage_api_key") ?? "";
    let cancelled = false;

    fetch(`${API_URL}/v1/campaigns?limit=20`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: CampaignsResponse | null) => {
        if (cancelled) return;
        if (data) {
          setCampaigns(data.campaigns);
          setNextCursor(data.nextCursor);
          setHasMore(data.hasMore);
        } else {
          setCampaigns([]);
        }
      })
      .catch(() => {
        if (!cancelled) setCampaigns([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = async () => {
    if (!nextCursor) return;
    const apiKey = localStorage.getItem("engage_api_key") ?? "";
    try {
      const res = await fetch(
        `${API_URL}/v1/campaigns?limit=20&cursor=${nextCursor}`,
        {
          headers: { "x-api-key": apiKey },
        },
      );
      if (!res.ok) return;
      const data = (await res.json()) as CampaignsResponse;
      setCampaigns((prev) => [...prev, ...data.campaigns]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      // ignore
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta campaña?")) return;
    const apiKey = localStorage.getItem("engage_api_key") ?? "";
    try {
      const res = await fetch(`${API_URL}/v1/campaigns/${id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });
      if (res.ok) {
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      // ignore
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Campañas ({campaigns.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && campaigns.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay campañas todavía
          </p>
        ) : (
          <>
            <div className="divide-y">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center gap-4 py-3 hover:bg-muted/30 rounded-md px-2 -mx-2 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="font-medium text-sm hover:underline"
                    >
                      {campaign.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {campaign.type}
                      </Badge>
                      <Badge
                        variant={
                          STATUS_COLORS[campaign.status] as
                            | "default"
                            | "secondary"
                            | "outline"
                        }
                        className="text-xs"
                      >
                        {campaign.status}
                      </Badge>
                      {campaign.channels.length > 0 && (
                        <span>{campaign.channels.join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(campaign.createdAt).toLocaleString("es-AR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="flex gap-2">
                    {campaign.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Trigger campaign
                          const apiKey =
                            localStorage.getItem("engage_api_key") ?? "";
                          fetch(
                            `${API_URL}/v1/campaigns/${campaign.id}/trigger`,
                            {
                              method: "POST",
                              headers: { "x-api-key": apiKey },
                            },
                          );
                        }}
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                    )}
                    <Link href={`/campaigns/${campaign.id}`}>
                      <Button variant="outline" size="sm">
                        <Edit className="h-3 w-3" />
                      </Button>
                    </Link>
                    {campaign.status === "draft" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(campaign.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="pt-4 flex justify-center">
                <Button variant="outline" size="sm" onClick={loadMore}>
                  Cargar más
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
