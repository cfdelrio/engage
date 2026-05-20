import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const API_URL = process.env['INTERNAL_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const API_KEY = process.env['INTERNAL_API_KEY'] ?? '';

interface ChannelData {
  channel: string;
  status: string;
  _count: number;
}

async function getChannelData(): Promise<ChannelData[]> {
  try {
    const res = await fetch(`${API_URL}/v1/analytics/channels`, {
      headers: { 'x-api-key': API_KEY },
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

const CHANNEL_EMOJIS: Record<string, string> = {
  email: '📧',
  sms: '💬',
  push: '🔔',
  whatsapp: '💚',
  voice: '📞',
  in_app: '📱',
};

export async function ChannelBreakdown() {
  const data = await getChannelData();

  const byChannel = data.reduce<Record<string, { sent: number; delivered: number }>>((acc, item) => {
    if (!acc[item.channel]) acc[item.channel] = { sent: 0, delivered: 0 };
    if (item.status === 'sent' || item.status === 'delivered') {
      acc[item.channel]!.sent += item._count;
    }
    if (item.status === 'delivered') {
      acc[item.channel]!.delivered += item._count;
    }
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Canales (7 días)</CardTitle>
      </CardHeader>
      <CardContent>
        {Object.keys(byChannel).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos aún</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(byChannel).map(([channel, { sent, delivered }]) => {
              const rate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
              return (
                <div key={channel}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>
                      {CHANNEL_EMOJIS[channel] ?? '📨'} {channel}
                    </span>
                    <span className="text-muted-foreground">{rate}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{sent} enviados</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
