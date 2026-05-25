"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  Mail,
  MessageSquare,
  Bell,
  MessageCircle,
  Phone,
  UserX,
} from "lucide-react";

interface PreferenceStats {
  totalUsers: number;
  globalUnsubscribeCount: number;
  globalUnsubscribes: Array<{
    externalId: string;
    email: string | null;
    channel: string;
    reason: string | null;
    createdAt: string;
  }>;
  channelOptOuts: Array<{ channel: string; count: number }>;
}

const CHANNEL_META: Record<string, { label: string; icon: React.ElementType }> =
  {
    email: { label: "Email", icon: Mail },
    sms: { label: "SMS", icon: MessageSquare },
    push: { label: "Push", icon: Bell },
    whatsapp: { label: "WhatsApp", icon: MessageCircle },
    voice: { label: "Voice", icon: Phone },
  };

export default function PreferencesPage() {
  const [stats, setStats] = useState<PreferenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/admin/preferences/stats", {})
      .then((r: Response) => r.json())
      .then((data: PreferenceStats) => setStats(data))
      .catch(() => setError("No se pudo cargar las estadísticas"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight">
          Preference Center
        </h1>
        <p className="text-muted-foreground mt-2">
          Opt-outs y preferencias de canales de todos los usuarios
        </p>
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="h-32 bg-muted rounded-lg animate-pulse" />
          <div className="h-64 bg-muted rounded-lg animate-pulse" />
        </div>
      )}

      {error && <div className="text-sm text-destructive">{error}</div>}

      {stats && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Total usuarios
              </p>
              <p className="text-3xl font-bold mt-1">{stats.totalUsers}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Opt-out global
              </p>
              <p className="text-3xl font-bold mt-1 text-destructive">
                {stats.globalUnsubscribeCount}
              </p>
            </div>
            {stats.channelOptOuts.map((c) => {
              const meta = CHANNEL_META[c.channel];
              const Icon = meta?.icon ?? UserX;
              return (
                <div key={c.channel} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {meta?.label ?? c.channel} opt-out
                    </p>
                  </div>
                  <p className="text-3xl font-bold">{c.count}</p>
                </div>
              );
            })}
          </div>

          {/* Global unsubscribes table */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <UserX className="h-4 w-4 text-destructive" />
              <h2 className="font-semibold text-sm">Opt-out global</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                {stats.globalUnsubscribeCount} usuarios
              </span>
            </div>
            {stats.globalUnsubscribes.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No hay usuarios con opt-out global
              </div>
            ) : (
              <div className="divide-y">
                {stats.globalUnsubscribes.map((u, i) => (
                  <div
                    key={i}
                    className="px-4 py-3 flex items-center gap-3 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-muted-foreground truncate">
                        {u.externalId}
                      </p>
                      <p className="truncate">{u.email ?? "—"}</p>
                    </div>
                    {u.reason && (
                      <span className="text-xs text-muted-foreground italic shrink-0">
                        {u.reason}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(u.createdAt).toLocaleDateString("es-AR")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
