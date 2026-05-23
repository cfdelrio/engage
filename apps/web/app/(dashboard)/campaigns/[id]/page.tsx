"use client";

import { apiFetch } from "@/lib/api-client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  channels: string[];
  templateId: string | null;
  trigger: Record<string, unknown>;
  rules: Record<string, unknown>;
  aiConfig: Record<string, unknown>;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  runs: Array<{
    id: string;
    status: string;
    triggeredBy: string | null;
    startedAt: string;
    completedAt: string | null;
  }>;
}

export default function CampaignDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = use(props.params);
  const campaignId = params.id;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch(`/v1/campaigns/${campaignId}`, {})
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Campaign | null) => {
        if (cancelled) return;
        if (data) {
          setCampaign(data);
        } else {
          setError("Campaign not found");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load campaign");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="space-y-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <p className="text-sm text-muted-foreground">{error ?? "No data"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="-ml-3">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mt-2">{campaign.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="text-muted-foreground mb-1">Type</div>
              <Badge variant="outline">{campaign.type}</Badge>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Status</div>
              <Badge>{campaign.status}</Badge>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Channels</div>
              <div className="flex gap-2 flex-wrap">
                {campaign.channels.map((ch) => (
                  <Badge key={ch} variant="secondary">
                    {ch}
                  </Badge>
                ))}
              </div>
            </div>
            {campaign.startAt && (
              <div>
                <div className="text-muted-foreground mb-1">Starts</div>
                <span>{new Date(campaign.startAt).toLocaleString()}</span>
              </div>
            )}
            {campaign.endAt && (
              <div>
                <div className="text-muted-foreground mb-1">Ends</div>
                <span>{new Date(campaign.endAt).toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Runs</CardTitle>
          </CardHeader>
          <CardContent>
            {campaign.runs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No runs yet</p>
            ) : (
              <div className="space-y-2 text-xs">
                {campaign.runs.map((run) => (
                  <div key={run.id} className="p-2 bg-muted rounded">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {run.status}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(run.startedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
