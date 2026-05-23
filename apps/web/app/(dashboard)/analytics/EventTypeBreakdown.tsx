"use client";

import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EventStat {
  type: string;
  _count: number;
}

export function EventTypeBreakdown() {
  const [events, setEvents] = useState<EventStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/v1/analytics/events`, {})
      .then((res) => (res.ok ? res.json() : []))
      .then((d: EventStat[]) => setEvents(d))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const maxCount = Math.max(...events.map((e) => e._count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Events (7d)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-5 w-48 bg-muted rounded animate-pulse" />
                <div className="flex-1 h-2 bg-muted rounded animate-pulse" />
                <div className="h-4 w-10 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No data available
          </p>
        ) : (
          <div className="space-y-3">
            {events.slice(0, 10).map((event) => (
              <div key={event.type} className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="font-mono text-xs w-64 truncate"
                >
                  {event.type}
                </Badge>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(event._count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-12 text-right">
                  {event._count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
