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

interface WhatsAppCampaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  body: string;
  headerType?: string;
  headerValue?: string;
  footerText?: string;
  createdAt: string;
}

interface WhatsAppMessage {
  id: string;
  phone: string;
  status: string;
  twilioMessageSid?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  errorMessage?: string;
}

interface Metrics {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
}

export default function WhatsAppCampaignDetailPage({ params }: { params: { id: string } }) {
  const [campaign, setCampaign] = useState<WhatsAppCampaign | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

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
      setMetrics(metricsData.stats);
      setMessages(messagesData.messages || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handlePauseCampaign() {
    try {
      await fetch(`/api/v1/whatsapp-campaigns/${params.id}/pause`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Failed to pause campaign:', err);
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      sent: 'bg-blue-200',
      delivered: 'bg-green-200',
      read: 'bg-purple-200',
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
          <p className="text-sm text-gray-600">Leídas</p>
          <p className="text-3xl font-bold">{metrics.read}</p>
          <p className="text-xs text-gray-500">{metrics.readRate}%</p>
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
            <Badge className="bg-green-200">{campaign.status}</Badge>
          </div>
          {campaign.headerType && (
            <div>
              <p className="text-sm text-gray-600">Header</p>
              <p className="text-sm">
                Tipo: {campaign.headerType}
                {campaign.headerValue && ` - ${campaign.headerValue}`}
              </p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Mensaje</p>
            <p className="text-sm bg-gray-100 p-3 rounded">{campaign.body}</p>
          </div>
          {campaign.footerText && (
            <div>
              <p className="text-sm text-gray-600">Footer</p>
              <p className="text-sm">{campaign.footerText}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Creada el</p>
            <p className="text-sm">{new Date(campaign.createdAt).toLocaleString('es-AR')}</p>
          </div>
        </div>
      </div>

      {/* Messages Log */}
      <div className="rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Historial de Mensajes</h2>
        </div>
        {messages.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Sin mensajes enviados</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Enviado</TableHead>
                <TableHead>Entregado</TableHead>
                <TableHead>Leído</TableHead>
                <TableHead>Detalles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map((msg) => (
                <TableRow key={msg.id}>
                  <TableCell className="font-mono text-sm">{msg.phone}</TableCell>
                  <TableCell>{getStatusBadge(msg.status)}</TableCell>
                  <TableCell>
                    {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString('es-AR') : '-'}
                  </TableCell>
                  <TableCell>
                    {msg.deliveredAt ? new Date(msg.deliveredAt).toLocaleTimeString('es-AR') : '-'}
                  </TableCell>
                  <TableCell>
                    {msg.readAt ? new Date(msg.readAt).toLocaleTimeString('es-AR') : '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {msg.errorMessage && (
                      <span className="text-red-600" title={msg.errorMessage}>
                        Error
                      </span>
                    )}
                    {msg.twilioMessageSid && (
                      <span className="text-gray-500 text-xs">{msg.twilioMessageSid.slice(0, 8)}...</span>
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
