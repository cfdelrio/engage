"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, Globe, Activity } from "lucide-react";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

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
  }>;
}

interface EngagementResponse {
  score: UserDetail["engagementScore"];
  recentDeliveries: Array<{
    id: string;
    channel: string;
    status: string;
    sentAt: string | null;
    deliveredAt: string | null;
    openedAt: string | null;
    createdAt: string;
  }>;
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

  useEffect(() => {
    const apiKey = localStorage.getItem("engage_api_key") ?? "";
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
            userRes.status === 404
              ? "Usuario no encontrado"
              : "No se pudo cargar",
          );
          return;
        }
        setUser((await userRes.json()) as UserDetail);
        if (engagementRes.ok) {
          setEngagement((await engagementRes.json()) as EngagementResponse);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Error de red");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Link href="/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
        <p className="text-sm text-muted-foreground">{error ?? "Sin datos"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/users">
            <Button variant="ghost" size="sm" className="-ml-3">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a usuarios
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold mt-2 font-mono">
            {user.externalId}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {user.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{user.email}</span>
              </div>
            )}
            {user.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{user.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span>
                {user.timezone} · {user.locale}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Creado</span>
              <span>{new Date(user.createdAt).toLocaleString("es-AR")}</span>
            </div>
            {user.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap pt-2">
                {user.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {engagement?.score ? (
              <>
                <ScoreRow
                  label="Score"
                  value={engagement.score.score}
                  format={(v) => v.toFixed(2)}
                />
                <ScoreRow
                  label="Fatigue"
                  value={engagement.score.fatigueScore}
                  format={(v) => v.toFixed(2)}
                />
                <ScoreRow
                  label="Open rate 30d"
                  value={engagement.score.openRate30d}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
                <ScoreRow
                  label="Click rate 30d"
                  value={engagement.score.clickRate30d}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
              </>
            ) : (
              <p className="text-muted-foreground text-xs">
                Sin score calculado todavía
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deliveries recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {!engagement?.recentDeliveries ||
          engagement.recentDeliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin deliveries
            </p>
          ) : (
            <div className="divide-y">
              {engagement.recentDeliveries.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 py-3 text-sm"
                >
                  <Badge variant="outline" className="text-xs">
                    {d.channel}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {d.id.slice(0, 12)}…
                  </span>
                  <span className="ml-auto">
                    <DeliveryStatusBadge status={d.status} />
                  </span>
                  <span className="text-xs text-muted-foreground w-32 text-right">
                    {new Date(d.createdAt).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreRow({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{format(value)}</span>
    </div>
  );
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

function DeliveryStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "outline"} className="text-xs">
      {status}
    </Badge>
  );
}
