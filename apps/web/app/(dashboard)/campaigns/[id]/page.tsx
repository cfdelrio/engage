"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

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
    const apiKey = localStorage.getItem("engage_api_key") ?? "";
    let cancelled = false;

    fetch(`${API_URL}/v1/campaigns/${campaignId}`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Campaign | null) => {
        if (cancelled) return;
        if (data) {
          setCampaign(data);
        } else {
          setError("Campaña no encontrada");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Error al cargar");
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
      <div>
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="-ml-3">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a campañas
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{campaign.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="text-muted-foreground mb-1">Tipo</div>
              <Badge variant="outline">{campaign.type}</Badge>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Estado</div>
              <Badge>{campaign.status}</Badge>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Canales</div>
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
                <div className="text-muted-foreground mb-1">Comienza</div>
                <span>
                  {new Date(campaign.startAt).toLocaleString("es-AR")}
                </span>
              </div>
            )}
            {campaign.endAt && (
              <div>
                <div className="text-muted-foreground mb-1">Termina</div>
                <span>{new Date(campaign.endAt).toLocaleString("es-AR")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ejecuciones</CardTitle>
          </CardHeader>
          <CardContent>
            {campaign.runs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin ejecuciones</p>
            ) : (
              <div className="space-y-2 text-xs">
                {campaign.runs.map((run) => (
                  <div key={run.id} className="p-2 bg-muted rounded">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {run.status}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(run.startedAt).toLocaleString("es-AR", {
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
