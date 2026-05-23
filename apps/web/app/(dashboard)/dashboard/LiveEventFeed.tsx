"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

interface LiveEvent {
  id: string;
  type: string;
  userId: string;
  receivedAt: string;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  "prode.ranking.changed": "bg-blue-500",
  "prode.new_leader": "bg-yellow-500",
  "prode.user_overtaken": "bg-orange-500",
  "match.goal_scored": "bg-green-500",
  "user.inactive": "bg-gray-500",
  "user.payment_pending": "bg-red-500",
};

export function LiveEventFeed() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // When served over HTTPS, use the same origin so WSS goes through nginx
    // (nginx proxies /v1/* to the API with WebSocket support). This avoids
    // mixed-content blocks when NEXT_PUBLIC_API_URL points to a plain-HTTP URL.
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
            setEvents((prev) => [event, ...prev].slice(0, 100));
          } catch {
            // ignore malformed messages
          }
        };
      } catch {
        setTimeout(connect, 3000);
      }
    };

    connect();
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Live Event Stream</CardTitle>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
          />
          <span className="text-xs text-muted-foreground">
            {connected ? "Connected" : "Connecting..."}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Activity className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Esperando eventos...</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 text-sm py-2 border-b last:border-0"
              >
                <div
                  className={`h-2 w-2 rounded-full flex-shrink-0 ${EVENT_TYPE_COLORS[event.type] ?? "bg-purple-500"}`}
                />
                <Badge
                  variant="outline"
                  className="font-mono text-xs max-w-[200px] truncate"
                >
                  {event.type}
                </Badge>
                <span className="text-muted-foreground font-mono text-xs truncate flex-1">
                  {event.userId}
                </span>
                <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">
                  {new Date(event.receivedAt).toLocaleTimeString("es-AR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
