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
  status: string;
  body: string;
  stats: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
  createdAt: string;
}

export default function WhatsAppCampaignsPage() {
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    body: '',
    headerType: 'text',
    headerValue: '',
    footerText: '',
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    try {
      const res = await fetch('/api/v1/whatsapp-campaigns');
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
      const res = await fetch('/api/v1/whatsapp-campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setFormData({ name: '', body: '', headerType: 'text', headerValue: '', footerText: '' });
        setShowForm(false);
        fetchCampaigns();
      }
    } catch (err) {
      console.error('Failed to create campaign:', err);
    }
  }

  async function handleStartCampaign(id: string) {
    try {
      await fetch(`/api/v1/whatsapp-campaigns/${id}/start`, { method: 'POST' });
      fetchCampaigns();
    } catch (err) {
      console.error('Failed to start campaign:', err);
    }
  }

  async function handleDeleteCampaign(id: string) {
    try {
      await fetch(`/api/v1/whatsapp-campaigns/${id}`, { method: 'DELETE' });
      fetchCampaigns();
    } catch (err) {
      console.error('Failed to delete campaign:', err);
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-200',
      active: 'bg-green-200',
      paused: 'bg-yellow-200',
      completed: 'bg-blue-200',
    };
    return <Badge className={colors[status] || 'bg-gray-200'}>{status}</Badge>;
  };

  if (loading) {
    return <div className="flex justify-center py-12">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">WhatsApp Campaigns</h1>
        <Button onClick={() => setShowForm(!showForm)} className="bg-green-600 hover:bg-green-700">
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
                <label className="block text-sm font-medium">Tipo Header</label>
                <select
                  value={formData.headerType}
                  onChange={(e) => setFormData({ ...formData, headerType: e.target.value })}
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="text">Texto</option>
                  <option value="image">Imagen</option>
                  <option value="document">Documento</option>
                  <option value="video">Video</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Header Value</label>
                <input
                  type="text"
                  value={formData.headerValue}
                  onChange={(e) => setFormData({ ...formData, headerValue: e.target.value })}
                  className="w-full rounded border px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Footer</label>
              <input
                type="text"
                value={formData.footerText}
                onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
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
                <TableHead>Estado</TableHead>
                <TableHead>Enviadas</TableHead>
                <TableHead>Entregadas</TableHead>
                <TableHead>Leídas</TableHead>
                <TableHead>Fallidas</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                  <TableCell>{campaign.stats.sent}</TableCell>
                  <TableCell>{campaign.stats.delivered}</TableCell>
                  <TableCell>{campaign.stats.read}</TableCell>
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
