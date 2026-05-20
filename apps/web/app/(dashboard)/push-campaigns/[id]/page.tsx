'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PushCampaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
  priority: string;
  createdAt: string;
}

interface PushNotification {
  id: string;
  userId: string;
  status: string;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  failedAt?: string;
  errorMessage?: string;
}

interface Metrics {
  sent: number;
  delivered: number;
  opened: number;
  failed: number;
  deliveryRate: number;
  openRate: number;
}

export default function PushCampaignDetailPage({ params }: { params: { id: string } }) {
  const [campaign, setCampaign] = useState<PushCampaign | null>(null);
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

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
      setMetrics(metricsData.stats);
      setNotifications(notificationsData.notifications || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [params.id]);

  async function handlePauseCampaign() {
    try {
      await fetch(`/api/v1/push-campaigns/${params.id}/pause`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Failed to pause campaign:', err);
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      sent: 'bg-blue-200',
      delivered: 'bg-green-200',
      opened: 'bg-purple-200',
      failed: 'bg-red-200',
    };
    return <Badge className={colors[status] || 'bg-gray-200'}>{status}</Badge>;
  };

  if (loading) {
    return <div className="flex justify-center py-12">Cargando...</div>;
  }

  if (!campaign || !metrics) {
    return <div className="text-center py-12">Campaña no encontrada</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          {campaign.description && <p className="text-gray-600 mt-2">{campaign.description}</p>}
        </div>
        {campaign.status === 'active' && (
          <Button onClick={handlePauseCampaign} variant="destructive">
            Pausar Campaña
          </Button>
        )}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-600">Enviadas</p>
          <p className="text-3xl font-bold">{metrics.sent}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-600">Entregadas</p>
          <p className="text-3xl font-bold">{metrics.delivered}</p>
          <p className="text-xs text-gray-500">{metrics.deliveryRate}%</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-600">Abiertas</p>
          <p className="text-3xl font-bold">{metrics.opened}</p>
          <p className="text-xs text-gray-500">{metrics.openRate}%</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-600">Fallidas</p>
          <p className="text-3xl font-bold text-red-600">{metrics.failed}</p>
        </div>
      </div>

      {/* Campaign Details */}
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Detalles de la Campaña</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">Estado</p>
            <Badge className="bg-blue-200">{campaign.status}</Badge>
          </div>
          <div>
            <p className="text-sm text-gray-600">Prioridad</p>
            <Badge className={campaign.priority === 'high' ? 'bg-red-200' : 'bg-yellow-200'}>
              {campaign.priority}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-gray-600">Título</p>
            <p className="text-sm font-semibold">{campaign.title}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Mensaje</p>
            <p className="text-sm bg-gray-100 p-3 rounded">{campaign.body}</p>
          </div>
          {campaign.imageUrl && (
            <div>
              <p className="text-sm text-gray-600">Imagen</p>
              <p className="text-sm text-blue-600 truncate">{campaign.imageUrl}</p>
            </div>
          )}
          {campaign.actionUrl && (
            <div>
              <p className="text-sm text-gray-600">URL de Acción</p>
              <p className="text-sm text-blue-600 truncate">{campaign.actionUrl}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Creada el</p>
            <p className="text-sm">{new Date(campaign.createdAt).toLocaleString('es-AR')}</p>
          </div>
        </div>
      </div>

      {/* Notifications Log */}
      <div className="rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Historial de Notificaciones</h2>
        </div>
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Sin notificaciones enviadas</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario ID</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Enviada</TableHead>
                <TableHead>Entregada</TableHead>
                <TableHead>Abierta</TableHead>
                <TableHead>Detalles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((notif) => (
                <TableRow key={notif.id}>
                  <TableCell className="font-mono text-sm">{notif.userId.slice(0, 8)}...</TableCell>
                  <TableCell>{getStatusBadge(notif.status)}</TableCell>
                  <TableCell>
                    {notif.sentAt ? new Date(notif.sentAt).toLocaleTimeString('es-AR') : '-'}
                  </TableCell>
                  <TableCell>
                    {notif.deliveredAt
                      ? new Date(notif.deliveredAt).toLocaleTimeString('es-AR')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {notif.openedAt ? new Date(notif.openedAt).toLocaleTimeString('es-AR') : '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {notif.errorMessage && (
                      <span className="text-red-600" title={notif.errorMessage}>
                        Error
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
