'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PushMetrics {
  campaignId: string;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  };
}

interface PushNotification {
  id: string;
  phone: string;
  status: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  createdAt: string;
}

interface Campaign {
  id: string;
  name: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
  };
}

export default function PushCampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [metrics, setMetrics] = useState<PushMetrics | null>(null);
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  async function fetchData() {
    try {
      const [campaignRes, metricsRes, notificationsRes] = await Promise.all([
        fetch(`/api/v1/push-campaigns/${params.id}`),
        fetch(`/api/v1/push-campaigns/${params.id}/metrics`),
        fetch(`/api/v1/push-campaigns/${params.id}/notifications`),
      ]);

      const campaignData = await campaignRes.json();
      const metricsData = await metricsRes.json();
      const notificationsData = await notificationsRes.json();

      setCampaign(campaignData);
      setMetrics(metricsData);
      setNotifications(notificationsData.notifications || []);
    } catch (err) {
      console.error('Failed to fetch campaign data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !campaign || !metrics) {
    return <div className="text-gray-500">Cargando...</div>;
  }

  const statusColors: Record<string, string> = {
    queued: 'bg-blue-100 text-blue-800',
    sent: 'bg-gray-100 text-gray-800',
    delivered: 'bg-green-100 text-green-800',
    opened: 'bg-purple-100 text-purple-800',
    clicked: 'bg-indigo-100 text-indigo-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{campaign.name}</h1>
        <p className="text-gray-600">
          {campaign.title} • Estado:{' '}
          <Badge className="bg-blue-100 text-blue-800">{campaign.status}</Badge>
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Enviadas</div>
          <div className="text-2xl font-bold">{metrics.stats.sent}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Entregadas</div>
          <div className="text-2xl font-bold">{metrics.stats.delivered}</div>
          <div className="text-xs text-gray-500">{metrics.stats.deliveryRate}% tasa</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Abiertas</div>
          <div className="text-2xl font-bold">{metrics.stats.opened}</div>
          <div className="text-xs text-gray-500">{metrics.stats.openRate}% tasa</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Clickeadas</div>
          <div className="text-2xl font-bold">{metrics.stats.clicked}</div>
          <div className="text-xs text-gray-500">{metrics.stats.clickRate}% tasa</div>
        </Card>
      </div>

      {/* Campaign Details */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Detalles Campaña</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Título</label>
            <p className="font-mono text-sm">{campaign.title}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Cuerpo</label>
            <p className="font-mono text-sm whitespace-pre-wrap">{campaign.body}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Prioridad</label>
              <p className="font-mono text-sm capitalize">{campaign.priority}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Estado</label>
              <Badge className="bg-green-100 text-green-800 mt-1">{campaign.status}</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent Notifications */}
      <Card>
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Notificaciones Recientes</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Entregada</TableHead>
              <TableHead>Abierta</TableHead>
              <TableHead>Clickeada</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.slice(0, 20).map((notif) => (
              <TableRow key={notif.id}>
                <TableCell className="font-mono text-xs">{notif.id.slice(0, 8)}</TableCell>
                <TableCell>
                  <Badge className={statusColors[notif.status] || statusColors.sent}>
                    {notif.status}
                  </Badge>
                </TableCell>
                <TableCell>{notif.deliveredAt ? '✓' : '—'}</TableCell>
                <TableCell>{notif.openedAt ? '✓' : '—'}</TableCell>
                <TableCell>{notif.clickedAt ? '✓' : '—'}</TableCell>
                <TableCell className="text-sm text-gray-600">
                  {new Date(notif.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
