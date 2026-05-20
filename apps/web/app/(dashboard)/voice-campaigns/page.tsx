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
import { AlertCircle } from 'lucide-react';

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

const API_URL = process.env['INTERNAL_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export default function VoiceCampaignsPage() {
  const [campaigns, setCampaigns] = useState<VoiceCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    script: 'Hola {{user.firstName}}, este es un mensaje de ORKESTAI ENGAGE',
    voiceConfig: {
      language: 'es-ES',
      voice: 'female' as 'male' | 'female',
      speed: 1.0,
      provider: 'twilio',
    },
  });

  const refetchCampaigns = async () => {
    try {
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      const res = await fetch(`${API_URL}/v1/voice-campaigns/campaigns`, {
        headers: { 'x-api-key': apiKey },
      });
      const data = await res.json();
      setCampaigns(data || []);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const apiKey = localStorage.getItem('engage_api_key') ?? '';
        const res = await fetch(`${API_URL}/v1/voice-campaigns/campaigns`, {
          headers: { 'x-api-key': apiKey },
        });
        const data = await res.json();
        setCampaigns(data || []);
      } catch (err) {
        console.error('Failed to fetch campaigns:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    try {
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      const res = await fetch(`${API_URL}/v1/voice-campaigns/campaigns`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setFormData({
          name: '',
          description: '',
          script: 'Hola {{user.firstName}}, este es un mensaje de ORKESTAI ENGAGE',
          voiceConfig: {
            language: 'es-ES',
            voice: 'female',
            speed: 1.0,
            provider: 'twilio',
          },
        });
        setShowForm(false);
        refetchCampaigns();
      }
    } catch (err) {
      console.error('Failed to create campaign:', err);
    }
  }

  async function handleStartCampaign(id: string) {
    try {
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      await fetch(`${API_URL}/v1/voice-campaigns/campaigns/${id}/start`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
      });
      refetchCampaigns();
    } catch (err) {
      console.error('Failed to start campaign:', err);
    }
  }

  async function handleDeleteCampaign(id: string) {
    if (!confirm('¿Estás seguro de que querés eliminar esta campaña?')) return;
    try {
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      await fetch(`${API_URL}/v1/voice-campaigns/campaigns/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey },
      });
      refetchCampaigns();
    } catch (err) {
      console.error('Failed to delete campaign:', err);
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-200',
      active: 'bg-blue-200',
      paused: 'bg-yellow-200',
      completed: 'bg-green-200',
    };
    return <Badge className={colors[status] || 'bg-gray-200'}>{status}</Badge>;
  };

  if (loading) {
    return <div className="flex justify-center py-12">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campañas de Voz</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestiona campañas de llamadas telefónicas automatizadas</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700">
          {showForm ? 'Cancelar' : 'Nueva Campaña'}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border p-6">
          <form onSubmit={handleCreateCampaign} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Nombre</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded border px-3 py-2"
                placeholder="Ej: Reactivación de usuarios inactivos"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Descripción</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded border px-3 py-2"
                rows={2}
                placeholder="Descripción opcional de la campaña"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Script (Handlebars)</label>
              <textarea
                required
                value={formData.script}
                onChange={(e) => setFormData({ ...formData, script: e.target.value })}
                className="w-full rounded border px-3 py-2 font-mono text-sm"
                rows={4}
                placeholder="Usa {{variable}} para personalización"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usa &#123;&#123;user.firstName&#125;&#125;, &#123;&#123;user.lastName&#125;&#125; para variables
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Idioma</label>
                <select
                  value={formData.voiceConfig.language}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      voiceConfig: { ...formData.voiceConfig, language: e.target.value },
                    })
                  }
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="es-ES">Español (España)</option>
                  <option value="es-MX">Español (México)</option>
                  <option value="es-AR">Español (Argentina)</option>
                  <option value="en-US">Inglés (USA)</option>
                  <option value="pt-BR">Portugués (Brasil)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Voz</label>
                <select
                  value={formData.voiceConfig.voice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      voiceConfig: { ...formData.voiceConfig, voice: e.target.value as 'male' | 'female' },
                    })
                  }
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="female">Femenina</option>
                  <option value="male">Masculina</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Velocidad de Reproducción</label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={formData.voiceConfig.speed}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    voiceConfig: { ...formData.voiceConfig, speed: parseFloat(e.target.value) },
                  })
                }
                className="w-full"
              />
              <span className="text-sm text-muted-foreground">{formData.voiceConfig.speed.toFixed(1)}x</span>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Crear Campaña
            </Button>
          </form>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-gray-500">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          Sin campañas de voz. Crea una para comenzar.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Llamadas Enviadas</TableHead>
                <TableHead>Respondidas</TableHead>
                <TableHead>Completadas</TableHead>
                <TableHead>Fallidas</TableHead>
                <TableHead>Duración Promedio</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {campaign.description || '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                  <TableCell>{campaign.stats.sent}</TableCell>
                  <TableCell>{campaign.stats.answered}</TableCell>
                  <TableCell>{campaign.stats.completed}</TableCell>
                  <TableCell className="text-red-600">{campaign.stats.failed}</TableCell>
                  <TableCell className="text-sm">{campaign.stats.avgDuration.toFixed(0)}s</TableCell>
                  <TableCell className="space-x-2">
                    {campaign.status === 'draft' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartCampaign(campaign.id)}
                        >
                          Iniciar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                        >
                          Eliminar
                        </Button>
                      </>
                    )}
                    {(campaign.status === 'active' || campaign.status === 'paused') && (
                      <Button size="sm" variant="outline" className="text-blue-600">
                        Ver Detalles
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
