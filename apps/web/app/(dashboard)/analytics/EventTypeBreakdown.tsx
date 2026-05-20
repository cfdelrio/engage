import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_URL = process.env['INTERNAL_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const API_KEY = process.env['INTERNAL_API_KEY'] ?? '';

interface EventStat {
  type: string;
  _count: number;
}

async function getEventStats(): Promise<EventStat[]> {
  try {
    const res = await fetch(`${API_URL}/v1/analytics/events`, {
      headers: { 'x-api-key': API_KEY },
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function EventTypeBreakdown() {
  const events = await getEventStats();
  const maxCount = Math.max(...events.map((e) => e._count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Eventos más frecuentes (7d)</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
        ) : (
          <div className="space-y-3">
            {events.slice(0, 10).map((event) => (
              <div key={event.type} className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono text-xs w-64 truncate">
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
