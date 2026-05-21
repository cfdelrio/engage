'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trash2, Edit2 } from 'lucide-react';
import Link from 'next/link';

interface PushCampaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
  priority: 'high' | 'normal';
  stats: { sent: number; delivered: number; opened: number; failed: number };
  createdAt: string;
}

interface Delivery {
  id: string;
  userId: string;
  status: 'queued' | 'sent' | 'delivered' | 'opened' | 'failed';
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
};

const deliveryStatusColors: Record<string, string> = {
  queued: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  opened: 'bg-purple-100 text-purple-700',
  failed: 'bg-red-100 text-red-700',
};

export default function PushCampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<PushCampaign | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deliveryFilter, setDeliveryFilter] = useState<string>('');

  useEffect(() => {
    fetchCampaign();
    fetchDeliveries();
  }, [campaignId]);

  async function fetchCampaign() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/push-campaigns/${campaignId}`);
      if (!res.ok) throw new Error('Failed to load campaign');
      const data = await res.json();
      setCampaign(data);
    } catch (err) {
      setError(String(err).replace('Error: ', ''));
    } finally {
      setLoading(false);
    }
  }

  async function fetchDeliveries() {
    try {
      const res = await fetch(`/api/v1/push-campaigns/${campaignId}/deliveries`);
      if (!res.ok) return;
      const data = await res.json();
      setDeliveries(data);
    } catch (err) {
      console.error('Failed to load deliveries:', err);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure? This action cannot be undone.')) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/v1/push-campaigns/${campaignId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      router.push('/campaigns/push');
    } catch (err) {
      setError(String(err).replace('Error: ', ''));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Loading campaign...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Campaign not found</p>
        <Link href="/campaigns/push">
          <Button variant="outline">Back to Campaigns</Button>
        </Link>
      </div>
    );
  }

  const filteredDeliveries = deliveryFilter
    ? deliveries.filter(d => d.status === deliveryFilter)
    : deliveries;

  const sent = campaign.stats?.sent || 0;
  const delivered = campaign.stats?.delivered || 0;
  const opened = campaign.stats?.opened || 0;
  const deliveryRate = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : '0';
  const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campaigns/push">
            <Button variant="outline" size="icon">
              <ArrowLeft size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{campaign.name}</h1>
            <p className="text-slate-600 mt-1">{campaign.description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === 'draft' && (
            <>
              <Link href={`/campaigns/push/${campaignId}/edit`}>
                <Button variant="outline" className="gap-2">
                  <Edit2 size={18} />
                  Edit
                </Button>
              </Link>
              <Button
                variant="outline"
                className="text-red-600 hover:bg-red-50"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 size={18} />
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-800 text-sm">{error}</p>
        </Card>
      )}

      {/* Status & Metrics */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-xs text-slate-600 uppercase mb-1">Status</p>
          <Badge className={statusColors[campaign.status]}>{campaign.status}</Badge>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-600 uppercase mb-2">Sent</p>
          <p className="text-2xl font-bold">{sent.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-600 uppercase mb-2">Delivered</p>
          <p className="text-2xl font-bold">{delivered.toLocaleString()}</p>
          <p className="text-xs text-slate-500">{deliveryRate}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-600 uppercase mb-2">Opened</p>
          <p className="text-2xl font-bold">{opened.toLocaleString()}</p>
          <p className="text-xs text-slate-500">{openRate}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-600 uppercase mb-2">Failed</p>
          <p className="text-2xl font-bold text-red-600">{(campaign.stats?.failed || 0).toLocaleString()}</p>
        </Card>
      </div>

      {/* Campaign Details */}
      <Card className="p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Campaign Details</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs text-slate-600 uppercase mb-2">Priority</label>
            <Badge className={campaign.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'}>
              {campaign.priority}
            </Badge>
          </div>
          <div>
            <label className="block text-xs text-slate-600 uppercase mb-2">Created</label>
            <p className="text-slate-900">{new Date(campaign.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </Card>

      {/* Push Notification Preview */}
      <Card className="p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Notification Preview</h2>
        <div className="bg-gradient-to-b from-slate-100 to-slate-50 p-6 rounded-lg max-w-sm">
          {campaign.imageUrl && (
            <img src={campaign.imageUrl} alt="notification" className="w-full rounded mb-3 max-h-48 object-cover" />
          )}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
            <p className="font-semibold text-slate-900 mb-1">{campaign.title}</p>
            <p className="text-sm text-slate-600">{campaign.body}</p>
            {campaign.actionUrl && (
              <p className="text-xs text-blue-600 mt-2">Tap to open: {campaign.actionUrl}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Delivery Log */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Delivery Log</h2>
          <select
            value={deliveryFilter}
            onChange={(e) => setDeliveryFilter(e.target.value)}
            className="px-3 py-1 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">All Statuses ({deliveries.length})</option>
            {Object.keys(deliveryStatusColors).map(status => {
              const count = deliveries.filter(d => d.status === status).length;
              return (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {filteredDeliveries.length === 0 ? (
          <p className="text-center text-slate-600 py-8">
            {deliveries.length === 0 ? 'No deliveries yet' : 'No deliveries with this status'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-600">User ID</th>
                  <th className="px-4 py-2 text-left text-slate-600">Status</th>
                  <th className="px-4 py-2 text-left text-slate-600">Sent</th>
                  <th className="px-4 py-2 text-left text-slate-600">Delivered</th>
                  <th className="px-4 py-2 text-left text-slate-600">Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDeliveries.slice(0, 50).map(delivery => (
                  <tr key={delivery.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-xs">{delivery.userId.slice(0, 8)}</td>
                    <td className="px-4 py-2">
                      <Badge className={deliveryStatusColors[delivery.status]}>
                        {delivery.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {delivery.sentAt ? new Date(delivery.sentAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {delivery.deliveredAt ? new Date(delivery.deliveredAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {delivery.openedAt ? new Date(delivery.openedAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredDeliveries.length > 50 && (
              <p className="text-xs text-slate-600 mt-2">Showing 50 of {filteredDeliveries.length} deliveries</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
