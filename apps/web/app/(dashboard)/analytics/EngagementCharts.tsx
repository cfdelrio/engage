import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const API_URL = process.env['INTERNAL_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const API_KEY = process.env['INTERNAL_API_KEY'] ?? '';

interface ChannelMetric {
  channel: string;
  status: string;
  _count: number;
}

async function getChannelMetrics(): Promise<ChannelMetric[]> {
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
  email: '📧', sms: '💬', push: '🔔', whatsapp: '💚', voice: '📞', in_app: '📱',
};

export async function EngagementCharts() {
  const data = await getChannelMetrics();

  const byChannel = data.reduce<Record<string, Record<string, number>>>((acc, item) => {
    if (!acc[item.channel]) acc[item.channel] = {};
    acc[item.channel]![item.status] = item._count;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rendimiento por Canal (7d)</CardTitle>
      </CardHeader>
      <CardContent>
        {Object.keys(byChannel).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(byChannel).map(([channel, stats]) => {
              const sent = (stats['sent'] ?? 0) + (stats['delivered'] ?? 0);
              const delivered = stats['delivered'] ?? 0;
              const opened = stats['opened'] ?? 0;
              const failed = stats['failed'] ?? 0;

              return (
                <div key={channel} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {CHANNEL_EMOJIS[channel] ?? '📨'} {channel.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: 'Sent', value: sent, color: 'text-blue-600' },
                      { label: 'Delivered', value: delivered, color: 'text-green-600' },
                      { label: 'Opened', value: opened, color: 'text-purple-600' },
                      { label: 'Failed', value: failed, color: 'text-red-600' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-muted rounded p-2">
                        <p className={`text-lg font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
