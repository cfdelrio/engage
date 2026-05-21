'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CampaignScheduling } from '@/components/campaign/CampaignScheduling';
import { ArrowLeft, Trash2, Edit2 } from 'lucide-react';
import Link from 'next/link';

interface WhatsAppCampaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  body: string;
  headerType: 'text' | 'image' | 'document' | 'video';
  headerValue?: string;
  footerText?: string;
  buttons?: Array<{ id: string; title: string }>;
  stats: { sent: number; delivered: number; read: number; failed: number };
  createdAt: string;
}

interface Message {
  id: string;
  phone: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
};

const messageStatusColors: Record<string, string> = {
  queued: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  read: 'bg-purple-100 text-purple-700',
  failed: 'bg-red-100 text-red-700',
};

export default function WhatsAppCampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<WhatsAppCampaign | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [messageFilter, setMessageFilter] = useState<string>('');

  const fetchCampaign = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/whatsapp-campaigns/${campaignId}`);
      if (!res.ok) throw new Error('Failed to load campaign');
      const data = await res.json();
      setCampaign(data);
    } catch (err) {
      setError(String(err).replace('Error: ', ''));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/whatsapp-campaigns/${campaignId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaign();
    fetchMessages();
  }, [fetchCampaign, fetchMessages]);

  async function handleDelete() {
    if (!confirm('Are you sure? This action cannot be undone.')) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/v1/whatsapp-campaigns/${campaignId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      router.push('/campaigns/whatsapp');
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
        <Link href="/campaigns/whatsapp">
          <Button variant="outline">Back to Campaigns</Button>
        </Link>
      </div>
    );
  }

  const filteredMessages = messageFilter
    ? messages.filter(m => m.status === messageFilter)
    : messages;

  const sent = campaign.stats?.sent || 0;
  const delivered = campaign.stats?.delivered || 0;
  const read = campaign.stats?.read || 0;
  const deliveryRate = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : '0';
  const readRate = sent > 0 ? ((read / sent) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campaigns/whatsapp">
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
              <Link href={`/campaigns/whatsapp/${campaignId}/edit`}>
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
          <p className="text-xs text-slate-600 uppercase mb-2">Read</p>
          <p className="text-2xl font-bold">{read.toLocaleString()}</p>
          <p className="text-xs text-slate-500">{readRate}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-600 uppercase mb-2">Failed</p>
          <p className="text-2xl font-bold text-red-600">{(campaign.stats?.failed || 0).toLocaleString()}</p>
        </Card>
      </div>

      {/* Campaign Details */}
      <Card className="p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Message Configuration</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block text-xs text-slate-600 uppercase mb-2">Header Type</label>
            <p className="text-slate-900">{campaign.headerType}</p>
          </div>
          <div>
            <label className="block text-xs text-slate-600 uppercase mb-2">Buttons</label>
            <p className="text-slate-900">{campaign.buttons?.length || 0} action(s)</p>
          </div>
          <div>
            <label className="block text-xs text-slate-600 uppercase mb-2">Created</label>
            <p className="text-slate-900">{new Date(campaign.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </Card>

      {/* Message Preview */}
      <Card className="p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Message Preview</h2>
        <div className="bg-gradient-to-b from-green-50 to-slate-50 p-6 rounded-lg max-w-sm">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
            {campaign.headerValue && campaign.headerType === 'text' && (
              <p className="text-sm font-semibold text-slate-900 mb-2">{campaign.headerValue}</p>
            )}
            {campaign.headerValue && campaign.headerType === 'image' && (
              <Image src={campaign.headerValue} alt="header" width={400} height={128} className="w-full rounded mb-2" style={{ objectFit: "cover" }} />
            )}
            <p className="text-sm text-slate-900 mb-2">{campaign.body}</p>
            {campaign.footerText && (
              <p className="text-xs text-slate-600 mb-3">{campaign.footerText}</p>
            )}
            {campaign.buttons && campaign.buttons.length > 0 && (
              <div className="space-y-2">
                {campaign.buttons.map(btn => (
                  <div key={btn.id} className="bg-slate-50 border border-slate-200 rounded py-2 px-3 text-center text-sm text-slate-900">
                    {btn.title}
                  </div>
                ))}
              </div>
            )}
          </div>
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

      {/* Message Log */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Message Log</h2>
          <select
            value={messageFilter}
            onChange={(e) => setMessageFilter(e.target.value)}
            className="px-3 py-1 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">All Statuses ({messages.length})</option>
            {Object.keys(messageStatusColors).map(status => {
              const count = messages.filter(m => m.status === status).length;
              return (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {filteredMessages.length === 0 ? (
          <p className="text-center text-slate-600 py-8">
            {messages.length === 0 ? 'No messages yet' : 'No messages with this status'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-600">Phone</th>
                  <th className="px-4 py-2 text-left text-slate-600">Status</th>
                  <th className="px-4 py-2 text-left text-slate-600">Sent</th>
                  <th className="px-4 py-2 text-left text-slate-600">Delivered</th>
                  <th className="px-4 py-2 text-left text-slate-600">Read</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredMessages.slice(0, 50).map(message => (
                  <tr key={message.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">{message.phone}</td>
                    <td className="px-4 py-2">
                      <Badge className={messageStatusColors[message.status]}>
                        {message.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {message.sentAt ? new Date(message.sentAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {message.deliveredAt ? new Date(message.deliveredAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {message.readAt ? new Date(message.readAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredMessages.length > 50 && (
              <p className="text-xs text-slate-600 mt-2">Showing 50 of {filteredMessages.length} messages</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
