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

interface PushCampaign {
  id: string;
  name: string;
  description?: string;
  title: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
  };
  createdAt: string;
}

export default function PushCampaignsPage() {
  const [campaigns, setCampaigns] = useState<PushCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    try {
      const res = await fetch('/api/v1/push-campaigns');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  }

  async function startCampaign(id: string) {
    try {
      await fetch(`/api/v1/push-campaigns/${id}/start`, { method: 'POST' });
      fetchCampaigns();
    } catch (err) {
      console.error('Failed to start campaign:', err);
    }
  }

  async function pauseCampaign(id: string) {
    try {
      await fetch(`/api/v1/push-campaigns/${id}/pause`, { method: 'POST' });
      fetchCampaigns();
    } catch (err) {
      console.error('Failed to pause campaign:', err);
    }
  }

  async function deleteCampaign(id: string) {
    if (!confirm('¿Eliminar campaña? No se puede deshacer.')) return;
    try {
      await fetch(`/api/v1/push-campaigns/${id}`, { method: 'DELETE' });
      fetchCampaigns();
    } catch (err) {
      console.error('Failed to delete campaign:', err);
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Campañas Push</h1>
          <p className="text-gray-600">Gestiona notificaciones push a dispositivos</p>
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
              <DialogTitle>Crear Campaña Push</DialogTitle>
            </DialogHeader>
            <PushCampaignForm
              onSuccess={() => {
                setIsCreateOpen(false);
                fetchCampaigns();
              }}
            />
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
                <TableHead>Título</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-center">Enviadas</TableHead>
                <TableHead className="text-center">Entregadas</TableHead>
                <TableHead className="text-center">Abiertas</TableHead>
                <TableHead className="text-center">Clickeadas</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell className="text-sm">{campaign.title}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[campaign.status]}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{campaign.stats.sent}</TableCell>
                  <TableCell className="text-center">{campaign.stats.delivered}</TableCell>
                  <TableCell className="text-center">{campaign.stats.opened}</TableCell>
                  <TableCell className="text-center">{campaign.stats.clicked}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => (window.location.href = `/push-campaigns/${campaign.id}`)}
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

function PushCampaignForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    title: '',
    body: '',
    imageUrl: '',
    actionUrl: '',
    priority: 'high',
    sound: 'default',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/push-campaigns', {
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
          placeholder="Mi Campaña Push"
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
        <label className="block text-sm font-medium mb-1">Título Notificación</label>
        <input
          type="text"
          required
          className="w-full px-3 py-2 border rounded-md"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Título que verá el usuario"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Cuerpo Notificación</label>
        <textarea
          required
          className="w-full px-3 py-2 border rounded-md"
          value={formData.body}
          onChange={(e) => setFormData({ ...formData, body: e.target.value })}
          placeholder="Hola {{user.firstName}}, tenemos novedades para ti"
          rows={3}
        />
        <p className="text-xs text-gray-500 mt-1">
          Variables disponibles: {'{user.firstName}'}, {'{user.email}'}, {'{user.phone}'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">URL Imagen</label>
          <input
            type="url"
            className="w-full px-3 py-2 border rounded-md"
            value={formData.imageUrl}
            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
            placeholder="https://example.com/image.png"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">URL Acción</label>
          <input
            type="url"
            className="w-full px-3 py-2 border rounded-md"
            value={formData.actionUrl}
            onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
            placeholder="https://example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Prioridad</label>
          <select
            className="w-full px-3 py-2 border rounded-md"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
          >
            <option value="high">Alta</option>
            <option value="default">Normal</option>
            <option value="low">Baja</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Sonido</label>
          <select
            className="w-full px-3 py-2 border rounded-md"
            value={formData.sound}
            onChange={(e) => setFormData({ ...formData, sound: e.target.value })}
          >
            <option value="default">Por defecto</option>
            <option value="silent">Silencioso</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="submit" className="w-full">
          Crear Campaña
        </Button>
      </div>
    </form>
  );
}
