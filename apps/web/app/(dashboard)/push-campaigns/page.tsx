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
  status: string;
  title: string;
  body: string;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    failed: number;
  };
  createdAt: string;
}

export default function PushCampaignsPage() {
  const [campaigns, setCampaigns] = useState<PushCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    body: '',
    imageUrl: '',
    actionUrl: '',
    priority: 'high',
  });

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

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/push-campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setFormData({
          name: '',
          title: '',
          body: '',
          imageUrl: '',
          actionUrl: '',
          priority: 'high',
        });
        setShowForm(false);
        fetchCampaigns();
      }
    } catch (err) {
      console.error('Failed to create campaign:', err);
    }
  }

  async function handleStartCampaign(id: string) {
    try {
      await fetch(`/api/v1/push-campaigns/${id}/start`, { method: 'POST' });
      fetchCampaigns();
    } catch (err) {
      console.error('Failed to start campaign:', err);
    }
  }

  async function handleDeleteCampaign(id: string) {
    try {
      await fetch(`/api/v1/push-campaigns/${id}`, { method: 'DELETE' });
      fetchCampaigns();
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
        <h1 className="text-3xl font-bold">Push Notifications</h1>
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
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Título</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Mensaje</label>
              <textarea
                required
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="w-full rounded border px-3 py-2"
                rows={4}
                placeholder="Usa {{user.firstName}} para personalización"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">URL Imagen</label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">URL Acción</label>
                <input
                  type="url"
                  value={formData.actionUrl}
                  onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                  className="w-full rounded border px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Prioridad</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full rounded border px-3 py-2"
              >
                <option value="high">Alta</option>
                <option value="normal">Normal</option>
              </select>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Crear Campaña
            </Button>
          </form>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-gray-500">
          Sin campañas. Crea una para comenzar.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Enviadas</TableHead>
                <TableHead>Entregadas</TableHead>
                <TableHead>Abiertas</TableHead>
                <TableHead>Fallidas</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>{campaign.title}</TableCell>
                  <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                  <TableCell>{campaign.stats.sent}</TableCell>
                  <TableCell>{campaign.stats.delivered}</TableCell>
                  <TableCell>{campaign.stats.opened}</TableCell>
                  <TableCell className="text-red-600">{campaign.stats.failed}</TableCell>
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
                    {campaign.status === 'active' && (
                      <Button size="sm" variant="outline">
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
