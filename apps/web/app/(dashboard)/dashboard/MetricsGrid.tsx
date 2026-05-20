import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Users, Zap, TrendingUp } from 'lucide-react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const API_KEY = process.env['INTERNAL_API_KEY'] ?? '';

async function getMetrics() {
  try {
    const res = await fetch(`${API_URL}/v1/analytics/overview`, {
      headers: { 'x-api-key': API_KEY },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<{
      totalDeliveries: number;
      totalUsers: number;
      recentEvents: number;
      deliveryByStatus: { status: string; _count: number }[];
    }>;
  } catch {
    return null;
  }
}

export async function MetricsGrid() {
  const data = await getMetrics();

  const delivered = data?.deliveryByStatus.find((d) => d.status === 'delivered')?._count ?? 0;
  const deliveryRate =
    data && data.totalDeliveries > 0
      ? Math.round((delivered / data.totalDeliveries) * 100)
      : 0;

  const metrics = [
    { title: 'Total Usuarios', value: data?.totalUsers?.toLocaleString() ?? '–', icon: Users, description: 'Registrados' },
    { title: 'Eventos (30d)', value: data?.recentEvents?.toLocaleString() ?? '–', icon: Zap, description: 'Procesados' },
    { title: 'Deliveries', value: data?.totalDeliveries?.toLocaleString() ?? '–', icon: Send, description: 'Total enviados' },
    { title: 'Delivery Rate', value: `${deliveryRate}%`, icon: TrendingUp, description: 'Últimos 30 días' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map(({ title, value, icon: Icon, description }) => (
        <Card key={title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
