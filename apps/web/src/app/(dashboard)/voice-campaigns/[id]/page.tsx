'use client';

import { useState, useEffect } from 'react';
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

interface VoiceCampaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  stats: {
    sent: number;
    answered: number;
    completed: number;
    failed: number;
    avgDuration: number;
  };
  script: string;
  createdAt: string;
}

interface VoiceCall {
  id: string;
  phone: string;
  status: string;
  duration?: number;
  sentiment?: string;
  createdAt: string;
}

export default function VoiceCampaignDetailPage({ params }: { params: { id: string } }) {
  const [campaign, setCampaign] = useState<VoiceCampaign | null>(null);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  async function fetchData() {
    try {
      const [campaignRes, callsRes] = await Promise.all([
        fetch(`/api/v1/voice-campaigns/${params.id}`),
        fetch(`/api/v1/voice-campaigns/${params.id}/calls`),
      ]);
      const campaignData = await campaignRes.json();
      const callsData = await callsRes.json();
      setCampaign(campaignData);
      setCalls(callsData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12">Cargando...</div>;
  }

  if (!campaign) {
    return <div className="text-center py-12">Campaña no encontrada</div>;
  }

  const successRate = campaign.stats.sent > 0 
    ? Math.round((campaign.stats.completed / campaign.stats.sent) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{campaign.name}</h1>
        <p className="text-gray-600">{campaign.description}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Enviadas</div>
          <div className="text-2xl font-bold">{campaign.stats.sent}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Respondidas</div>
          <div className="text-2xl font-bold text-blue-600">{campaign.stats.answered}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Completadas</div>
          <div className="text-2xl font-bold text-green-600">{campaign.stats.completed}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Tasa de Éxito</div>
          <div className="text-2xl font-bold">{successRate}%</div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Script</h2>
        <div className="bg-gray-50 p-4 rounded-md font-mono text-sm whitespace-pre-wrap">
          {campaign.script}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Llamadas Recientes</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Duración (s)</TableHead>
              <TableHead>Sentimiento</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.slice(0, 20).map((call) => (
              <TableRow key={call.id}>
                <TableCell className="font-mono">{call.phone}</TableCell>
                <TableCell>
                  <Badge variant={
                    call.status === 'completed' ? 'default' :
                    call.status === 'failed' ? 'destructive' :
                    'secondary'
                  }>
                    {call.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">{call.duration ?? '-'}</TableCell>
                <TableCell>
                  {call.sentiment ? (
                    <span className={
                      call.sentiment === 'positive' ? 'text-green-600' :
                      call.sentiment === 'negative' ? 'text-red-600' :
                      'text-gray-600'
                    }>
                      {call.sentiment}
                    </span>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {new Date(call.createdAt).toLocaleDateString('es-ES')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
