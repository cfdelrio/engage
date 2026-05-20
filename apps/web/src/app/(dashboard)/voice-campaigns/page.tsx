'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Pause, Trash2, Eye } from 'lucide-react';

interface VoiceCampaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
  stats: {
    sent: number;
    answered: number;
    completed: number;
    failed: number;
    avgDuration: number;
  };
  createdAt: string;
}

export default function VoiceCampaignsPage() {
  const [campaigns, setCampaigns] = useState<VoiceCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    try {
      const res = await fetch('/api/v1/voice-campaigns');
      const data = await res.json();
      setCampaigns(data);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  }

  async function startCampaign(id: string) {
    try {
      await fetch(`/api/v1/voice-campaigns/${id}/start`, { method: 'POST' });
      fetchCampaigns();
    } catch (err) {
      console.error('Failed to start campaign:', err);
    }
  }

  async function pauseCampaign(id: string) {
    try {
      await fetch(`/api/v1/voice-campaigns/${id}/pause`, { method: 'POST' });
      fetchCampaigns();
    } catch (err) {
      console.error('Failed to pause campaign:', err);
    }
  }

  async function deleteCampaign(id: string) {
    if (!confirm('¿Eliminar campaña? No se puede deshacer.')) return;
    try {
      await fetch(`/api/v1/voice-campaigns/${id}`, { method: 'DELETE' });
      fetchCampaigns();
    } catch (err) {
      console.error('Failed to delete campaign:', err);
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    scheduled: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Campañas de Voz</h1>
          <p className="text-gray-600">Gestiona llamadas telefónicas automatizadas</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nueva Campaña
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Campaña de Voz</DialogTitle>
            </DialogHeader>
            <VoiceCampaignForm onSuccess={() => {
              setIsCreateOpen(false);
              fetchCampaigns();
            }} />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="text-gray-500">Cargando campaña...</div>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-center">Enviadas</TableHead>
                <TableHead className="text-center">Respondidas</TableHead>
                <TableHead className="text-center">Completadas</TableHead>
                <TableHead className="text-center">Fallidas</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[campaign.status]}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{campaign.stats.sent}</TableCell>
                  <TableCell className="text-center">{campaign.stats.answered}</TableCell>
                  <TableCell className="text-center">{campaign.stats.completed}</TableCell>
                  <TableCell className="text-center text-red-600">{campaign.stats.failed}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => window.location.href = `/voice-campaigns/${campaign.id}`}
                    >
                      <Eye className="w-4 h-4" />
                      Ver
                    </Button>
                    {campaign.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => startCampaign(campaign.id)}
                      >
                        <Play className="w-4 h-4" />
                        Iniciar
                      </Button>
                    )}
                    {campaign.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => pauseCampaign(campaign.id)}
                      >
                        <Pause className="w-4 h-4" />
                        Pausar
                      </Button>
                    )}
                    {campaign.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-red-600"
                        onClick={() => deleteCampaign(campaign.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function VoiceCampaignForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    script: '',
    voiceConfig: {
      language: 'es-ES',
      voice: 'female',
    },
    dtmfConfig: {
      enabled: false,
      options: [],
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/voice-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to create campaign:', err);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nombre</label>
        <input
          type="text"
          required
          className="w-full px-3 py-2 border rounded-md"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Mi Campaña de Voz"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Descripción</label>
        <textarea
          className="w-full px-3 py-2 border rounded-md"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descripción de la campaña..."
          rows={2}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Script (Mensaje de Voz)</label>
        <textarea
          required
          className="w-full px-3 py-2 border rounded-md font-mono text-sm"
          value={formData.script}
          onChange={(e) => setFormData({ ...formData, script: e.target.value })}
          placeholder="Hola {{user.firstName}}, este es un mensaje de prueba."
          rows={4}
        />
        <p className="text-xs text-gray-500 mt-1">Variables disponibles: {'{user.firstName}'}, {'{user.email}'}, {'{user.phone}'}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Idioma</label>
          <select
            className="w-full px-3 py-2 border rounded-md"
            value={formData.voiceConfig.language}
            onChange={(e) => setFormData({
              ...formData,
              voiceConfig: { ...formData.voiceConfig, language: e.target.value },
            })}
          >
            <option value="es-ES">Español (España)</option>
            <option value="es-MX">Español (México)</option>
            <option value="en-US">English (USA)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Voz</label>
          <select
            className="w-full px-3 py-2 border rounded-md"
            value={formData.voiceConfig.voice}
            onChange={(e) => setFormData({
              ...formData,
              voiceConfig: { ...formData.voiceConfig, voice: e.target.value as 'male' | 'female' },
            })}
          >
            <option value="female">Mujer</option>
            <option value="male">Hombre</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="dtmf"
          checked={formData.dtmfConfig.enabled}
          onChange={(e) => setFormData({
            ...formData,
            dtmfConfig: { ...formData.dtmfConfig, enabled: e.target.checked },
          })}
          className="rounded"
        />
        <label htmlFor="dtmf" className="text-sm font-medium">Habilitar respuestas DTMF (presionar teclas)</label>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="submit" className="w-full">Crear Campaña</Button>
      </div>
    </form>
  );
}
