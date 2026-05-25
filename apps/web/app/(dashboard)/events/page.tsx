"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EventRow {
  id: string;
  type: string;
  userId: string;
  receivedAt: string;
  processedAt?: string;
  payload?: unknown;
  metadata?: unknown;
}

interface RuleExecution {
  id: string;
  matched: boolean;
  executedAt: string;
  rule?: { name: string };
}

interface EventDetail extends EventRow {
  processingLogs?: Array<{ step: string; status: string; processedAt: string }>;
  ruleExecutions?: RuleExecution[];
}

interface Delivery {
  id: string;
  channel: string;
  status: string;
  sentAt?: string;
  failureReason?: string;
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "ahora";
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function EventDetailDialog({
  event,
  onClose,
}: {
  event: EventRow;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch(`/v1/events/${event.id}`, {}).then((r) => r.json()),
      apiFetch(`/v1/deliveries?userId=${event.userId}&limit=10`, {}).then((r) =>
        r.json(),
      ),
    ])
      .then(([ev, del]) => {
        setDetail(ev as EventDetail);
        setDeliveries((del as { deliveries: Delivery[] }).deliveries ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [event.id, event.userId]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="pb-2 shrink-0">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-mono font-medium truncate">
                {event.type}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                user: {event.userId} ·{" "}
                {new Date(event.receivedAt).toLocaleString("es-AR")}
                {event.processedAt && (
                  <span className="ml-2 text-emerald-600">· procesado</span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="payload" className="flex-1 flex flex-col min-h-0">
            <TabsList className="shrink-0 w-full grid grid-cols-3">
              <TabsTrigger value="payload">Payload</TabsTrigger>
              <TabsTrigger value="rules">
                Reglas
                {detail?.ruleExecutions?.length ? (
                  <span className="ml-1.5 text-[10px] bg-muted rounded-full px-1.5">
                    {detail.ruleExecutions.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="deliveries">
                Deliveries
                {deliveries.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-muted rounded-full px-1.5">
                    {deliveries.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="payload"
              className="flex-1 overflow-auto mt-2 min-h-0"
            >
              <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
                {JSON.stringify(
                  { payload: detail?.payload, metadata: detail?.metadata },
                  null,
                  2,
                )}
              </pre>
            </TabsContent>

            <TabsContent
              value="rules"
              className="flex-1 overflow-auto mt-2 min-h-0"
            >
              {!detail?.ruleExecutions?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay ejecuciones de reglas para este evento
                </p>
              ) : (
                <div className="space-y-2">
                  {detail.ruleExecutions.map((re) => (
                    <div
                      key={re.id}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                    >
                      {re.matched ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      )}
                      <span className="text-sm flex-1 truncate">
                        {re.rule?.name ?? re.id}
                      </span>
                      <Badge variant={re.matched ? "default" : "secondary"}>
                        {re.matched ? "match" : "no match"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent
              value="deliveries"
              className="flex-1 overflow-auto mt-2 min-h-0"
            >
              {!deliveries.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay deliveries para este usuario en los últimos registros
                </p>
              ) : (
                <div className="space-y-2">
                  {deliveries.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                    >
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground w-16 shrink-0">
                        {d.channel}
                      </span>
                      <Badge
                        variant={
                          d.status === "delivered" || d.status === "sent"
                            ? "default"
                            : d.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-[11px]"
                      >
                        {d.status}
                      </Badge>
                      {d.sentAt && (
                        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {relativeTime(d.sentAt)}
                        </span>
                      )}
                      {d.failureReason && (
                        <span className="text-xs text-red-500 truncate max-w-[200px]">
                          {d.failureReason}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const cursorRef = useRef<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);

  const doFetch = (
    type: string,
    userId: string,
    cursor: string | undefined,
    reset: boolean,
  ) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (type) params.set("type", type);
    if (userId) params.set("userId", userId);
    if (!reset && cursor) params.set("cursor", cursor);

    apiFetch(`/v1/events?${params}`, {})
      .then((r) => r.json())
      .then((data: unknown) => {
        const rows = Array.isArray(data) ? (data as EventRow[]) : [];
        if (reset) {
          setEvents(rows);
        } else {
          setEvents((prev) => [...prev, ...rows]);
        }
        setHasMore(rows.length === 50);
        cursorRef.current = rows.at(-1)?.id;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cursorRef.current = undefined;
    doFetch(typeFilter, userFilter, undefined, true);
  }, [typeFilter, userFilter]);

  return (
    <div className="space-y-6">
      {selectedEvent && (
        <EventDetailDialog
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Eventos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Historial de eventos recibidos por el sistema
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            cursorRef.current = undefined;
            doFetch(typeFilter, userFilter, undefined, true);
          }}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Tipo de evento..."
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="User ID..."
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {(typeFilter || userFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTypeFilter("");
              setUserFilter("");
            }}
            className="gap-1.5 h-8"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/40 px-4 py-2.5 border-b border-border">
          <span>Tipo</span>
          <span className="px-4">Usuario</span>
          <span className="px-4">Estado</span>
          <span>Recibido</span>
        </div>

        <div className="divide-y divide-border/60">
          {loading && events.length === 0 ? (
            [...Array(8)].map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_auto_auto] px-4 py-3 items-center gap-4"
              >
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 w-24 bg-muted rounded animate-pulse px-4" />
                <div className="h-5 w-16 bg-muted rounded animate-pulse px-4" />
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))
          ) : events.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No se encontraron eventos
              {(typeFilter || userFilter) && " con los filtros aplicados"}
            </div>
          ) : (
            events.map((event) => (
              <button
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className="w-full grid grid-cols-[1fr_auto_auto_auto] px-4 py-3 items-center hover:bg-muted/30 transition-colors text-left gap-4"
              >
                <span className="text-xs font-mono truncate">{event.type}</span>
                <span className="text-xs text-muted-foreground font-mono px-4 truncate max-w-[120px]">
                  {event.userId}
                </span>
                <div className="px-4">
                  <Badge
                    variant={event.processedAt ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {event.processedAt ? "procesado" : "pendiente"}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {relativeTime(event.receivedAt)}
                </span>
              </button>
            ))
          )}
        </div>

        {hasMore && (
          <div className="flex justify-center py-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                doFetch(typeFilter, userFilter, cursorRef.current, false)
              }
              disabled={loading}
            >
              {loading ? "Cargando..." : "Cargar más"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
