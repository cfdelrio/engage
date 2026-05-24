"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Radio } from "lucide-react";

interface LiveEvent {
  id: string;
  type: string;
  userId: string;
  receivedAt: string;
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

export function LiveEventFeed() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [count, setCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const [, setTick] = useState(0);

  // Tick every 10s to refresh relative times
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const apiUrl =
      process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
    const wsUrl =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? `wss://${window.location.host}`
        : apiUrl.replace(/^https/, "wss").replace(/^http/, "ws");

    const connect = () => {
      try {
        const ws = new WebSocket(`${wsUrl}/v1/events/stream`);
        wsRef.current = ws;
        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();
        ws.onmessage = (msg) => {
          try {
            const event = JSON.parse(msg.data as string) as LiveEvent;
            setEvents((prev) => [event, ...prev].slice(0, 50));
            setCount((c) => c + 1);
          } catch {
            // ignore malformed messages
          }
        };
      } catch {
        setTimeout(connect, 3000);
      }
    };

    connect();
    return () => wsRef.current?.close();
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Radio className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Live Event Stream</span>
          {count > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
              {count.toLocaleString("es")}
            </span>
          )}
        </div>
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
      </div>

      {/* Events */}
      <div className="divide-y divide-border/60 max-h-[360px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 gap-3 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Activity className="h-5 w-5 opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Esperando eventos</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                Los eventos aparecen aquí en tiempo real
              </p>
            </div>
          </div>
        ) : (
          events.map((event, i) => {
            const cat = EVENT_CATEGORIES[event.type] ?? DEFAULT_CATEGORY;
            return (
              <div
                key={event.id}
                className={`flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors ${i === 0 ? "animate-event-enter" : ""}`}
              >
                <div
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${cat.dot}`}
                />
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
