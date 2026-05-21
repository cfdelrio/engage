"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  Mail,
  Phone,
  Globe,
  Clock,
  Tag,
  AlertCircle,
  Link2,
  Copy,
  Check,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useApiKey } from "@/hooks/useApiKey";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

const CHANNELS = ["email", "sms", "push", "whatsapp", "voice"] as const;

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  whatsapp: "WhatsApp",
  voice: "Voice",
};

interface UserDetail {
  id: string;
  externalId: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  locale: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  engagementScore: {
    score: number;
    fatigueScore: number;
    openRate30d: number;
    clickRate30d: number;
  } | null;
  preferences: Array<{
    id: string;
    channel: string;
    category: string;
    enabled: boolean;
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
  }>;
}

interface Delivery {
  id: string;
  channel: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  createdAt: string;
}

interface EngagementResponse {
  score: UserDetail["engagementScore"];
  recentDeliveries: Delivery[];
}

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  delivered: "default",
  opened: "default",
  clicked: "default",
  sent: "secondary",
  queued: "outline",
  failed: "destructive",
  suppressed: "outline",
};

const CHANNEL_COLORS: Record<string, string> = {
  email: "bg-blue-100 text-blue-800",
  sms: "bg-green-100 text-green-800",
  push: "bg-purple-100 text-purple-800",
  whatsapp: "bg-emerald-100 text-emerald-800",
  voice: "bg-orange-100 text-orange-800",
};

function scoreBadgeClass(score: number, inverted = false): string {
  const high = inverted ? score < 0.4 : score >= 0.7;
  const mid = inverted
    ? score >= 0.4 && score < 0.7
    : score >= 0.4 && score < 0.7;
  if (high) return "bg-green-100 text-green-800";
  if (mid) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

export default function UserDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = use(props.params);
  const userId = params.id;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [engagement, setEngagement] = useState<EngagementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prefSaving, setPrefSaving] = useState<string | null>(null);
  const [prefError, setPrefError] = useState<string | null>(null);
  const [prefCenterUrl, setPrefCenterUrl] = useState<string | null>(null);
  const [prefCenterExpiry, setPrefCenterExpiry] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const apiKey = useApiKey();

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`${API_URL}/v1/users/${userId}`, {
        headers: { "x-api-key": apiKey },
      }),
      fetch(`${API_URL}/v1/users/${userId}/engagement`, {
        headers: { "x-api-key": apiKey },
      }),
    ])
      .then(async ([userRes, engagementRes]) => {
        if (cancelled) return;
        if (!userRes.ok) {
          setError(
            userRes.status === 404 ? "User not found" : "Failed to load user",
          );
          return;
        }
        setUser((await userRes.json()) as UserDetail);
        if (engagementRes.ok) {
          setEngagement((await engagementRes.json()) as EngagementResponse);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Network error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, apiKey]);

  const handleTogglePreference = useCallback(
    async (channel: string, currentEnabled: boolean) => {
      if (!user) return;
      const newEnabled = !currentEnabled;
      setPrefSaving(channel);
      setPrefError(null);

      try {
        const res = await fetch(`${API_URL}/v1/users/${userId}/preferences`, {
          method: "PUT",
          headers: { "x-api-key": apiKey, "content-type": "application/json" },
          body: JSON.stringify([
            { channel, category: "all", enabled: newEnabled },
          ]),
        });
        if (!res.ok) throw new Error("Failed to update preference");
        setUser((prev) => {
          if (!prev) return prev;
          const existing = prev.preferences.find(
            (p) => p.channel === channel && p.category === "all",
          );
          if (existing) {
            return {
              ...prev,
              preferences: prev.preferences.map((p) =>
                p.channel === channel && p.category === "all"
                  ? { ...p, enabled: newEnabled }
                  : p,
              ),
            };
          }
          return {
            ...prev,
            preferences: [
              ...prev.preferences,
              {
                id: crypto.randomUUID(),
                channel,
                category: "all",
                enabled: newEnabled,
                quietHoursStart: null,
                quietHoursEnd: null,
              },
            ],
          };
        });
      } catch {
        setPrefError(`Failed to update ${channel} preference`);
      } finally {
        setPrefSaving(null);
      }
    },
    [user, userId, apiKey],
  );

  const handleGenerateLink = useCallback(async () => {
    setGeneratingLink(true);
    try {
      const res = await fetch(
        `${API_URL}/v1/users/${userId}/preferences/token`,
        {
          method: "POST",
          headers: { "x-api-key": apiKey, "content-type": "application/json" },
        },
      );
      if (!res.ok) throw new Error("Failed to generate link");
      const data = (await res.json()) as {
        token: string;
        expiresAt: string;
        url?: string;
      };
      const url =
        data.url ??
        `${window.location.origin}/public/preferences/${data.token}`;
      setPrefCenterUrl(url);
      setPrefCenterExpiry(data.expiresAt);
    } catch {
      setPrefError("Failed to generate preference center link");
    } finally {
      setGeneratingLink(false);
    }
  }, [userId, apiKey]);

  const handleCopyLink = useCallback(async () => {
    if (!prefCenterUrl) return;
    await navigator.clipboard.writeText(prefCenterUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [prefCenterUrl]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Link href="/users">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">{error ?? "No data"}</p>
        </div>
      </div>
    );
  }

  const engScore = engagement?.score ?? user.engagementScore;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/users">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-4xl font-bold font-mono">{user.externalId}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Created{" "}
            {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Engagement score summary bar */}
      {engScore && (
        <div className="grid grid-cols-4 gap-4">
          <ScoreCard
            label="Engagement"
            value={engScore.score}
            format={(v) => v.toFixed(2)}
            badgeClass={scoreBadgeClass(engScore.score)}
          />
          <ScoreCard
            label="Fatigue"
            value={engScore.fatigueScore}
            format={(v) => v.toFixed(2)}
            badgeClass={scoreBadgeClass(engScore.fatigueScore, true)}
          />
          <ScoreCard
            label="Open rate 30d"
            value={engScore.openRate30d}
            format={(v) => `${Math.round(v * 100)}%`}
            badgeClass={scoreBadgeClass(engScore.openRate30d)}
          />
          <ScoreCard
            label="Click rate 30d"
            value={engScore.clickRate30d}
            format={(v) => `${Math.round(v * 100)}%`}
            badgeClass={scoreBadgeClass(engScore.clickRate30d)}
          />
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="deliveries">
            Deliveries
            {engagement?.recentDeliveries &&
              engagement.recentDeliveries.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {engagement.recentDeliveries.length}
                </Badge>
              )}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Contact info and metadata</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{user.email}</span>
                </div>
              )}
              {user.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{user.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  {user.timezone} · {user.locale.toUpperCase()}
                </span>
              </div>
              {user.tags.length > 0 && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Tag className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex gap-1 flex-wrap">
                      {user.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {Object.keys(user.metadata).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Metadata
                    </p>
                    <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">
                      {JSON.stringify(user.metadata, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Preferences ── */}
        <TabsContent value="preferences" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Channel Preferences</CardTitle>
              <CardDescription>
                Opt-in/out per channel. Disabled channels will suppress
                deliveries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {prefError && (
                <div className="mb-4 text-sm text-destructive bg-destructive/10 p-3 rounded">
                  {prefError}
                </div>
              )}
              <div className="divide-y">
                {CHANNELS.map((channel) => {
                  const pref = user.preferences.find(
                    (p) => p.channel === channel && p.category === "all",
                  );
                  const enabled = pref ? pref.enabled : true;
                  const isSaving = prefSaving === channel;

                  return (
                    <div
                      key={channel}
                      className="py-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded ${CHANNEL_COLORS[channel] ?? ""}`}
                        >
                          {CHANNEL_LABELS[channel]}
                        </span>
                        {pref?.quietHoursStart != null &&
                          pref.quietHoursEnd != null && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Quiet {pref.quietHoursStart}:00 –{" "}
                              {pref.quietHoursEnd}:00
                            </span>
                          )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={enabled ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {enabled ? "Subscribed" : "Unsubscribed"}
                        </Badge>
                        <Button
                          size="sm"
                          variant={enabled ? "outline" : "default"}
                          disabled={isSaving}
                          onClick={() =>
                            handleTogglePreference(channel, enabled)
                          }
                        >
                          {isSaving
                            ? "..."
                            : enabled
                              ? "Unsubscribe"
                              : "Subscribe"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator className="my-6" />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Preference Center Link</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Send this link to the user so they can manage their
                  preferences without logging in.
                </p>

                {!prefCenterUrl ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generatingLink}
                    onClick={handleGenerateLink}
                  >
                    <Link2 className="h-3.5 w-3.5 mr-2" />
                    {generatingLink ? "Generating..." : "Generate Link"}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={prefCenterUrl}
                        className="flex-1 text-xs bg-muted rounded px-3 py-2 font-mono border border-border truncate"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyLink}
                        className="shrink-0"
                      >
                        {linkCopied ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      {prefCenterExpiry && (
                        <p className="text-xs text-muted-foreground">
                          Expires{" "}
                          {formatDistanceToNow(new Date(prefCenterExpiry), {
                            addSuffix: true,
                          })}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleGenerateLink}
                        disabled={generatingLink}
                        className="text-xs h-7 px-2"
                      >
                        {generatingLink ? "..." : "Generate New"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Deliveries ── */}
        <TabsContent value="deliveries" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Deliveries</CardTitle>
              <CardDescription>
                Last 20 messages sent to this user
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!engagement?.recentDeliveries ||
              engagement.recentDeliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No deliveries yet
                </p>
              ) : (
                <div className="divide-y">
                  {engagement.recentDeliveries.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-3 py-3 text-sm"
                    >
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${CHANNEL_COLORS[d.channel] ?? "bg-muted"}`}
                      >
                        {d.channel}
                      </span>
                      <code className="text-xs text-muted-foreground flex-1 truncate">
                        {d.id}
                      </code>
                      <Badge
                        variant={STATUS_VARIANTS[d.status] ?? "outline"}
                        className="text-xs shrink-0"
                      >
                        {d.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground shrink-0 w-28 text-right">
                        {formatDistanceToNow(new Date(d.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  format,
  badgeClass,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  badgeClass: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-2xl font-bold px-1 rounded inline-block ${badgeClass}`}
        >
          {format(value)}
        </p>
      </CardContent>
    </Card>
  );
}
