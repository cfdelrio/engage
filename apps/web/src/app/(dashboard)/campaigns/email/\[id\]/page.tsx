'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CampaignScheduling } from '@/components/campaign/CampaignScheduling';
import { ArrowLeft, Trash2, Edit2 } from 'lucide-react';
import Link from 'next/link';

interface EmailCampaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  subject: string;
  bodyHtml: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
  };
  createdAt: string;
  startAt?: string;
  endAt?: string;
}

interface Delivery {
  id: string;
  email: string;
  status: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
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
  clicked: 'bg-indigo-100 text-indigo-700',
  bounced: 'bg-orange-100 text-orange-700',
  failed: 'bg-red-100 text-red-700',
};

export default function EmailCampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<EmailCampaign | null>(null);
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
      const res = await fetch(`/api/v1/email-campaigns/${campaignId}`);
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
      const res = await fetch(`/api/v1/email-campaigns/${campaignId}/deliveries`);
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
      const res = await fetch(`/api/v1/email-campaigns/${campaignId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      router.push('/campaigns/email');
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
        <Link href="/campaigns/email">
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
          <Link href="/campaigns/email">
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
              <Link href={`/campaigns/email/${campaignId}/edit`}>
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
            <label className="block text-xs text-slate-600 uppercase mb-2">Subject</label>
            <p className="text-slate-900">{campaign.subject}</p>
          </div>
          <div>
            <label className="block text-xs text-slate-600 uppercase mb-2">From</label>
            <p className="text-slate-900">{campaign.fromName || 'Default'}</p>
            <p className="text-sm text-slate-600">{campaign.fromEmail}</p>
          </div>
          <div>
            <label className="block text-xs text-slate-600 uppercase mb-2">Reply-To</label>
            <p className="text-slate-900">{campaign.replyTo || 'Not set'}</p>
          </div>
          <div>
            <label className="block text-xs text-slate-600 uppercase mb-2">Created</label>
            <p className="text-slate-900">{new Date(campaign.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </Card>

      {/* Email Body */}
      <Card className="p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Email Body</h2>
        <div className="bg-slate-50 p-4 rounded border border-slate-200 max-h-96 overflow-y-auto">
          <div
            dangerouslySetInnerHTML={{ __html: campaign.bodyHtml }}
            className="prose prose-sm max-w-none"
          />
        </div>
      </Card>

      {/* Campaign Scheduling */}
      <CampaignScheduling
        campaignId={campaignId}
        currentStatus={campaign.status}
        startAt={campaign.startAt}
        endAt={campaign.endAt}
        onUpdate={fetchCampaign}
      />

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
                  <th className="px-4 py-2 text-left text-slate-600">Email</th>
                  <th className="px-4 py-2 text-left text-slate-600">Status</th>
                  <th className="px-4 py-2 text-left text-slate-600">Sent</th>
                  <th className="px-4 py-2 text-left text-slate-600">Delivered</th>
                  <th className="px-4 py-2 text-left text-slate-600">Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDeliveries.slice(0, 50).map(delivery => (
                  <tr key={delivery.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">{delivery.email}</td>
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
