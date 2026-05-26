"use client";

import { apiFetch } from "@/lib/api-client";

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

interface FeatureFlag {
  flag: string;
  tenantOverride: string | null;
  global: string | null;
  effective: string | null;
}

const FLAG_META: Record<string, { label: string; description: string }> = {
  ai_engagement_decisions: {
    label: "Decisiones de IA",
    description:
      "Usar IA para seleccionar el canal, el momento y las variantes de contenido",
  },
  voice_campaigns: {
    label: "Campañas de voz",
    description: "Activar campañas de llamadas de voz con Twilio y TTS",
  },
  whatsapp_channel: {
    label: "Canal WhatsApp",
    description: "Activar el envío de mensajes por WhatsApp",
  },
  analytics_v2: {
    label: "Analytics v2",
    description: "Analytics mejorado con métricas de performance de IA",
  },
  event_replay: {
    label: "Replay de eventos",
    description:
      "Reproducir eventos históricos a través del pipeline de procesamiento",
  },
};

export function FeatureFlagsCard() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/admin/feature-flags`, {})
      .then((res) => (res.ok ? res.json() : []))
      .then((data: FeatureFlag[]) => setFlags(data))
      .catch(() => setFlags([]))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (
    flag: string,
    currentEffective: string | null,
  ) => {
    const enable = currentEffective !== "1";
    setToggling(flag);
    try {
      const res = await apiFetch(`/admin/feature-flags/${flag}`, {
        method: "PUT",
        headers: {
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
          <CardTitle>Funcionalidades</CardTitle>
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
        <CardTitle>Funcionalidades</CardTitle>
        <CardDescription>
          Activá o desactivá funcionalidades para este tenant. Los cambios se
          aplican de inmediato.
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
                        override de tenant
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      variant={isEnabled ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {isEnabled ? "Activo" : "Inactivo"}
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
                          ? "Desactivar"
                          : "Activar"}
                    </Button>
                  </div>
                </div>
                {idx < flags.length - 1 && <Separator />}
              </div>
            );
          })}
          {flags.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay funcionalidades configuradas.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
