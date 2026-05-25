"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Activity, Radio, X, CheckCircle2, XCircle, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface LiveEvent {
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

interface EventDetail extends LiveEvent {
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

type EventCategory = {
  dot: string;
  label: string;
  bg: string;
  text: string;
};

const EVENT_CATEGORIES: Record<string, EventCategory> = {
  "prode.ranking.changed": {
    dot: "bg-blue-500",
    label: "Ranking",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
  },
  "prode.new_leader": {
    dot: "bg-yellow-500",
    label: "Líder",
    bg: "bg-yellow-500/10",
    text: "text-yellow-600 dark:text-yellow-400",
  },
  "prode.user_overtaken": {
    dot: "bg-orange-500",
    label: "Superado",
    bg: "bg-orange-500/10",
    text: "text-orange-600 dark:text-orange-400",
  },
  "match.goal_scored": {
    dot: "bg-emerald-500",
    label: "Goal",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  "user.inactive": {
    dot: "bg-gray-400",
    label: "Inactivo",
    bg: "bg-gray-400/10",
    text: "text-gray-500",
  },
  "user.payment_pending": {
    dot: "bg-red-500",
    label: "Pago",
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
  },
};

const DEFAULT_CATEGORY: EventCategory = {
  dot: "bg-violet-500",
  label: "Evento",
  bg: "bg-violet-500/10",
  text: "text-violet-600 dark:text-violet-400",
};

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "ahora";
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EventRow({
  event,
  isFirst,
  onClick,
}: {
  event: LiveEvent;
  isFirst: boolean;
  onClick: () => void;
}) {
  const cat = EVENT_CATEGORIES[event.type] ?? DEFAULT_CATEGORY;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40 transition-colors text-left ${isFirst ? "animate-event-enter" : ""}`}
    >
      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${cat.dot}`} />
      <span
        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium shrink-0 ${cat.bg} ${cat.text}`}
      >
        {cat.label}
      </span>
      <span className="text-xs font-mono text-muted-foreground/70 truncate flex-1 min-w-0">
        {event.type}
      </span>
      <span className="text-xs font-mono text-muted-foreground/50 truncate max-w-[90px] shrink-0">
        {event.userId.slice(0, 12)}
      </span>
      <span className="text-[11px] text-muted-foreground/40 shrink-0 tabular-nums">
        {relativeTime(event.receivedAt)}
      </span>
    </button>
  );
}

function EventDetailDialog({
  event,
  onClose,
}: {
  event: LiveEvent;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const cat = EVENT_CATEGORIES[event.type] ?? DEFAULT_CATEGORY;

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
            <span
              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${cat.bg} ${cat.text}`}
            >
              {cat.label}
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-mono font-medium truncate">
                {event.type}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                user: {event.userId} · {relativeTime(event.receivedAt)}
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
                {detail?.ruleExecutions && (
                  <span className="ml-1.5 text-[10px] bg-muted rounded-full px-1.5">
                    {detail.ruleExecutions.length}
                  </span>
                )}
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

export function LiveEventFeed() {
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [history, setHistory] = useState<LiveEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [count, setCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [typePrefix, setTypePrefix] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  // WebSocket for live events
  useEffect(() => {
    let destroyed = false;
    const apiUrl =
      process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
    const wsUrl =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? `wss://${window.location.host}`
        : apiUrl.replace(/^https/, "wss").replace(/^http/, "ws");

    const connect = () => {
      if (destroyed) return;
      try {
        const ws = new WebSocket(`${wsUrl}/v1/events/stream`);
        wsRef.current = ws;
        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          if (!destroyed) setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();
        ws.onmessage = (msg) => {
          try {
            const event = JSON.parse(msg.data as string) as LiveEvent;
            setLiveEvents((prev) => [event, ...prev].slice(0, 50));
            setCount((c) => c + 1);
          } catch {
            // ignore malformed messages
          }
        };
      } catch {
        if (!destroyed) setTimeout(connect, 3000);
      }
    };

    connect();
    return () => {
      destroyed = true;
      wsRef.current?.close();
    };
  }, []);

  // Fetch history when tab is activated
  const fetchHistory = useCallback(
    (from?: string, to?: string, prefix?: string) => {
      setHistoryLoading(true);
      const params = new URLSearchParams({ limit: "50" });
      if (from) params.set("from", `${from}T00:00:00.000Z`);
      if (to) params.set("to", `${to}T23:59:59.999Z`);
      if (prefix) params.set("typePrefix", prefix);
      apiFetch(`/v1/events?${params}`, {})
        .then((r) => r.json())
        .then((data) => setHistory(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    },
    [],
  );

  const handleTabChange = (tab: "live" | "history") => {
    setActiveTab(tab);
    if (tab === "history")
      fetchHistory(
        fromDate || undefined,
        toDate || undefined,
        typePrefix || undefined,
      );
  };

  useEffect(() => {
    if (activeTab === "history")
      fetchHistory(
        fromDate || undefined,
        toDate || undefined,
        typePrefix || undefined,
      );
  }, [fromDate, toDate, typePrefix, activeTab, fetchHistory]);

  const displayEvents = activeTab === "live" ? liveEvents : history;

  return (
    <>
      {selectedEvent && (
        <EventDetailDialog
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Radio className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Event Stream</span>
            {activeTab === "live" && count > 0 && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
                {count.toLocaleString("es")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Tab switcher */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden text-[11px]">
              <button
                onClick={() => handleTabChange("live")}
                className={`px-2.5 py-1 font-medium transition-colors ${activeTab === "live" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                En vivo
              </button>
              <button
                onClick={() => handleTabChange("history")}
                className={`px-2.5 py-1 font-medium transition-colors ${activeTab === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                Historial
              </button>
            </div>
            {activeTab === "live" && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div
                    className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-muted-foreground/40"} ${connected ? "animate-live-pulse" : ""}`}
                  />
                  {connected && (
                    <div className="absolute inset-0 h-2 w-2 rounded-full bg-emerald-500 animate-status-ring" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {connected ? "Conectado" : "Reconectando..."}
                </span>
              </div>
            )}
            {activeTab === "history" && (
              <div className="flex items-center gap-1.5">
                <select
                  value={typePrefix}
                  onChange={(e) => setTypePrefix(e.target.value)}
                  className="rounded-lg border border-border bg-muted/30 px-2 py-0.5 text-[11px] text-foreground outline-none cursor-pointer"
                >
                  <option value="">Todos</option>
                  <option value="prode">prode.*</option>
                  <option value="user">user.*</option>
                  <option value="match">match.*</option>
                </select>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    desde
                  </span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="text-[11px] bg-transparent text-foreground outline-none w-[90px] cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    hasta
                  </span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="text-[11px] bg-transparent text-foreground outline-none w-[90px] cursor-pointer"
                  />
                </div>
                {(fromDate || toDate || typePrefix) && (
                  <button
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                      setTypePrefix("");
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Limpiar filtros"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={() =>
                    fetchHistory(
                      fromDate || undefined,
                      toDate || undefined,
                      typePrefix || undefined,
                    )
                  }
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  disabled={historyLoading}
                >
                  {historyLoading ? "Cargando..." : "↺"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Events list */}
        <div className="divide-y divide-border/60 max-h-[360px] overflow-y-auto">
          {historyLoading ? (
            <div className="space-y-0 divide-y divide-border/60">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="h-4 w-16 bg-muted rounded animate-pulse shrink-0" />
                  <div className="h-3 flex-1 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-16 bg-muted rounded animate-pulse shrink-0" />
                </div>
              ))}
            </div>
          ) : displayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 gap-3 text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Activity className="h-5 w-5 opacity-40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {activeTab === "live"
                    ? "Esperando eventos"
                    : "Sin eventos recientes"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {activeTab === "live"
                    ? "Los eventos aparecen aquí en tiempo real"
                    : "No se encontraron eventos en el historial"}
                </p>
              </div>
            </div>
          ) : (
            displayEvents.map((event, i) => (
              <EventRow
                key={event.id}
                event={event}
                isFirst={i === 0 && activeTab === "live"}
                onClick={() => setSelectedEvent(event)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
