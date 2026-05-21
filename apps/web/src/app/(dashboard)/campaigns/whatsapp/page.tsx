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
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Pause, Eye } from 'lucide-react';
import Link from 'next/link';

interface WhatsAppCampaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  stats: { sent: number; delivered: number; read: number; failed: number };
  createdAt: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
};

export default function WhatsAppCampaignsPage() {
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/whatsapp-campaigns');
      if (!res.ok) throw new Error('Failed to load campaigns');
      const data = await res.json();
      setCampaigns(data);
    } catch (err) {
      setError(String(err).replace('Error: ', ''));
    } finally {
      setLoading(false);
    }
  }

  async function handleStartCampaign(id: string) {
    try {
      setActionLoading(id);
      const res = await fetch(`/api/v1/whatsapp-campaigns/${id}/start`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      await fetchCampaigns();
    } catch (err) {
      setError(String(err).replace('Error: ', ''));
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePauseCampaign(id: string) {
    try {
      setActionLoading(id);
      const res = await fetch(`/api/v1/whatsapp-campaigns/${id}/pause`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      await fetchCampaigns();
    } catch (err) {
      setError(String(err).replace('Error: ', ''));
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">WhatsApp Campaigns</h1>
          <p className="text-slate-600 mt-2">Create and manage WhatsApp message campaigns</p>
        </div>
        <Link href="/campaigns/whatsapp/new">
          <Button className="gap-2">
            <Plus size={20} />
            New Campaign
          </Button>
        </Link>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-800 text-sm">{error}</p>
        </Card>
      )}

      <Card className="p-6">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-slate-600">Loading campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-600 mb-4">No campaigns yet</p>
            <Link href="/campaigns/whatsapp/new">
              <Button>Create First Campaign</Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Read Rate</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => {
                const sent = campaign.stats?.sent || 0;
                const delivered = campaign.stats?.delivered || 0;
                const read = campaign.stats?.read || 0;
                const deliveryRate = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : '0';
                const readRate = sent > 0 ? ((read / sent) * 100).toFixed(1) : '0';

                return (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-slate-900">{campaign.name}</p>
                        <p className="text-sm text-slate-500">{campaign.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[campaign.status]}>{campaign.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{sent.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{deliveryRate}%</TableCell>
                    <TableCell className="text-right">{readRate}%</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/campaigns/whatsapp/${campaign.id}`}>
                          <Button variant="outline" size="icon">
                            <Eye size={16} />
                          </Button>
                        </Link>
                        {campaign.status === 'draft' && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleStartCampaign(campaign.id)}
                            disabled={actionLoading === campaign.id}
                          >
                            <Play size={16} />
                          </Button>
                        )}
                        {campaign.status === 'active' && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handlePauseCampaign(campaign.id)}
                            disabled={actionLoading === campaign.id}
                          >
                            <Pause size={16} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
