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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Clock } from 'lucide-react';

interface VoiceCampaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  script: string;
  voiceConfig: {
    language: string;
    voice: 'male' | 'female';
    speed: number;
    provider: string;
  };
  stats: {
    sent: number;
    answered: number;
    completed: number;
    failed: number;
    avgDuration: number;
  };
  createdAt: string;
}

interface VoiceCall {
  id: string;
  userId: string;
  phone: string;
  status: string;
  duration?: number;
  sentiment?: string;
  dtmfResponse?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  recordingUrl?: string;
}

interface Metrics {
  sent: number;
  answered: number;
  completed: number;
  failed: number;
  avgDuration: number;
  answerRate: number;
}

const API_URL = process.env['INTERNAL_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export default function VoiceCampaignDetailPage({ params }: { params: { id: string } }) {
  const [campaign, setCampaign] = useState<VoiceCampaign | null>(null);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      const [campaignRes, metricsRes, callsRes] = await Promise.all([
        fetch(`${API_URL}/v1/voice-campaigns/campaigns/${params.id}`, {
          headers: { 'x-api-key': apiKey },
        }),
        fetch(`${API_URL}/v1/voice-campaigns/campaigns/${params.id}/metrics`, {
          headers: { 'x-api-key': apiKey },
        }),
        fetch(`${API_URL}/v1/voice-campaigns/campaigns/${params.id}/calls`, {
          headers: { 'x-api-key': apiKey },
        }),
      ]);

      const campaignData = await campaignRes.json();
      await metricsRes.json();
      const callsData = await callsRes.json();

      setCampaign(campaignData);
      setMetrics({
        sent: campaignData.stats.sent,
        answered: campaignData.stats.answered,
        completed: campaignData.stats.completed,
        failed: campaignData.stats.failed,
        avgDuration: campaignData.stats.avgDuration,
        answerRate: campaignData.stats.sent > 0 ? (campaignData.stats.answered / campaignData.stats.sent) * 100 : 0,
      });
      setCalls(callsData || []);
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
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      await fetch(`${API_URL}/v1/voice-campaigns/campaigns/${params.id}/pause`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
      });
      fetchData();
    } catch (err) {
      console.error('Failed to pause campaign:', err);
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      queued: 'bg-yellow-200',
      ringing: 'bg-blue-200',
      'in-progress': 'bg-blue-200',
      completed: 'bg-green-200',
      failed: 'bg-red-200',
      'no-answer': 'bg-orange-200',
    };
    return <Badge className={colors[status] || 'bg-gray-200'}>{status}</Badge>;
  };

  const getSentimentColor = (sentiment?: string) => {
    const colors: Record<string, string> = {
      positive: 'text-green-600',
      neutral: 'text-gray-600',
      negative: 'text-red-600',
    };
    return colors[sentiment || ''] || 'text-gray-600';
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Enviadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.sent}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Respondidas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.answered}</p>
            <p className="text-xs text-gray-500">{metrics.answerRate.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Completadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{metrics.completed}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Fallidas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{metrics.failed}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Duración Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.avgDuration.toFixed(0)}s</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalles de la Campaña</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Estado</p>
              <Badge className="mt-1 bg-blue-200">{campaign.status}</Badge>
            </div>
            <div>
              <p className="text-sm text-gray-600">Idioma</p>
              <p className="text-sm font-semibold mt-1">{campaign.voiceConfig.language}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Voz</p>
              <p className="text-sm font-semibold mt-1">{campaign.voiceConfig.voice === 'female' ? 'Femenina' : 'Masculina'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Velocidad</p>
              <p className="text-sm font-semibold mt-1">{campaign.voiceConfig.speed.toFixed(1)}x</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600">Script</p>
            <p className="text-sm bg-gray-100 p-3 rounded mt-1 font-mono whitespace-pre-wrap">{campaign.script}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Creada el</p>
            <p className="text-sm mt-1">{new Date(campaign.createdAt).toLocaleString('es-AR')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Calls Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historial de Llamadas</CardTitle>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <div className="text-center py-12 text-gray-500">Sin llamadas realizadas</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Sentimiento</TableHead>
                    <TableHead>Respuesta DTMF</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Detalles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="font-mono text-sm">{call.phone}</TableCell>
                      <TableCell>{getStatusBadge(call.status)}</TableCell>
                      <TableCell className="text-sm">
                        {call.duration ? `${call.duration}s` : '-'}
                      </TableCell>
                      <TableCell>
                        {call.sentiment && (
                          <span className={`text-sm font-semibold ${getSentimentColor(call.sentiment)}`}>
                            {call.sentiment}
                          </span>
                        )}
                        {!call.sentiment && '-'}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {call.dtmfResponse ? call.dtmfResponse : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {call.startedAt ? new Date(call.startedAt).toLocaleTimeString('es-AR') : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {call.errorMessage && (
                          <span className="text-red-600 truncate max-w-xs" title={call.errorMessage}>
                            Error
                          </span>
                        )}
                        {call.recordingUrl && (
                          <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            Audio
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
