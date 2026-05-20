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

interface WhatsAppMetrics {
  campaignId: string;
  stats: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    deliveryRate: number;
    readRate: number;
  };
}

interface WhatsAppMessage {
  id: string;
  phone: string;
  status: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  createdAt: string;
}

interface Campaign {
  id: string;
  name: string;
  description?: string;
  body: string;
  status: string;
  headerType: string;
  headerValue?: string;
  footerText?: string;
  stats: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
}

export default function WhatsAppCampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [metrics, setMetrics] = useState<WhatsAppMetrics | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  async function fetchData() {
    try {
      const [campaignRes, metricsRes, messagesRes] = await Promise.all([
        fetch(`/api/v1/whatsapp-campaigns/${params.id}`),
        fetch(`/api/v1/whatsapp-campaigns/${params.id}/metrics`),
        fetch(`/api/v1/whatsapp-campaigns/${params.id}/messages`),
      ]);

      const campaignData = await campaignRes.json();
      const metricsData = await metricsRes.json();
      const messagesData = await messagesRes.json();

      setCampaign(campaignData);
      setMetrics(metricsData);
      setMessages(messagesData.messages || []);
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
    read: 'bg-purple-100 text-purple-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{campaign.name}</h1>
        <p className="text-gray-600">
          {campaign.description} • Estado:{' '}
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
          <div className="text-sm text-gray-600">Leídas</div>
          <div className="text-2xl font-bold">{metrics.stats.read}</div>
          <div className="text-xs text-gray-500">{metrics.stats.readRate}% tasa</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Fallidas</div>
          <div className="text-2xl font-bold text-red-600">{metrics.stats.failed}</div>
        </Card>
      </div>

      {/* Campaign Details */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Detalles Campaña</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Nombre</label>
            <p className="font-mono text-sm">{campaign.name}</p>
          </div>
          {campaign.description && (
            <div>
              <label className="text-sm text-gray-600">Descripción</label>
              <p className="font-mono text-sm">{campaign.description}</p>
            </div>
          )}
          <div>
            <label className="text-sm text-gray-600">Mensaje</label>
            <p className="font-mono text-sm whitespace-pre-wrap">{campaign.body}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Tipo Header</label>
              <p className="font-mono text-sm capitalize">{campaign.headerType}</p>
            </div>
            {campaign.headerValue && (
              <div>
                <label className="text-sm text-gray-600">Header Value</label>
                <p className="font-mono text-sm truncate">{campaign.headerValue}</p>
              </div>
            )}
          </div>
          {campaign.footerText && (
            <div>
              <label className="text-sm text-gray-600">Pie de Página</label>
              <p className="font-mono text-sm">{campaign.footerText}</p>
            </div>
          )}
          <div>
            <label className="text-sm text-gray-600">Estado</label>
            <Badge className="bg-green-100 text-green-800 mt-1">{campaign.status}</Badge>
          </div>
        </div>
      </Card>

      {/* Recent Messages */}
      <Card>
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Mensajes Recientes</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Entregada</TableHead>
              <TableHead>Leída</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.slice(0, 20).map((msg) => (
              <TableRow key={msg.id}>
                <TableCell className="font-mono text-xs">{msg.id.slice(0, 8)}</TableCell>
                <TableCell className="font-mono text-sm">{msg.phone}</TableCell>
                <TableCell>
                  <Badge className={statusColors[msg.status] || statusColors.sent}>
                    {msg.status}
                  </Badge>
                </TableCell>
                <TableCell>{msg.deliveredAt ? '✓' : '—'}</TableCell>
                <TableCell>{msg.readAt ? '✓' : '—'}</TableCell>
                <TableCell className="text-sm text-gray-600">
                  {new Date(msg.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
