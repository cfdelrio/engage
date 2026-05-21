'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trash2, Edit2 } from 'lucide-react';
import Link from 'next/link';

interface VoiceCampaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  script: string;
  voiceConfig: { language: string; voice: string; speed: number };
  stats: { sent: number; answered: number; completed: number; failed: number };
  createdAt: string;
}

interface VoiceCall {
  id: string;
  phone: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'no-answer';
  duration?: number;
  sentiment?: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
};

const callStatusColors: Record<string, string> = {
  queued: 'bg-slate-100 text-slate-700',
  ringing: 'bg-yellow-100 text-yellow-700',
  'in-progress': 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  'no-answer': 'bg-orange-100 text-orange-700',
  failed: 'bg-red-100 text-red-700',
};

export default function VoiceCampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<VoiceCampaign | null>(null);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [callFilter, setCallFilter] = useState<string>('');

  useEffect(() => {
    fetchCampaign();
    fetchCalls();
  }, [campaignId]);

  async function fetchCampaign() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/voice-campaigns/${campaignId}`);
      if (!res.ok) throw new Error('Failed to load campaign');
      const data = await res.json();
      setCampaign(data);
    } catch (err) {
      setError(String(err).replace('Error: ', ''));
    } finally {
      setLoading(false);
    }
  }

  async function fetchCalls() {
    try {
      const res = await fetch(`/api/v1/voice-campaigns/${campaignId}/calls`);
      if (!res.ok) return;
      const data = await res.json();
      setCalls(data);
    } catch (err) {
      console.error('Failed to load calls:', err);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure? This action cannot be undone.')) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/v1/voice-campaigns/${campaignId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      router.push('/campaigns/voice');
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
        <Link href="/campaigns/voice">
          <Button variant="outline">Back to Campaigns</Button>
        </Link>
      </div>
    );
  }

  const filteredCalls = callFilter ? calls.filter(c => c.status === callFilter) : calls;

  const sent = campaign.stats?.sent || 0;
  const answered = campaign.stats?.answered || 0;
  const completed = campaign.stats?.completed || 0;
  const answeredRate = sent > 0 ? ((answered / sent) * 100).toFixed(1) : '0';
  const completedRate = sent > 0 ? ((completed / sent) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campaigns/voice">
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
              <Link href={`/campaigns/voice/${campaignId}/edit`}>
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
          <p className="text-xs text-slate-600 uppercase mb-2">Calls</p>
          <p className="text-2xl font-bold">{sent.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-600 uppercase mb-2">Answered</p>
          <p className="text-2xl font-bold">{answered.toLocaleString()}</p>
          <p className="text-xs text-slate-500">{answeredRate}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-600 uppercase mb-2">Completed</p>
          <p className="text-2xl font-bold">{completed.toLocaleString()}</p>
          <p className="text-xs text-slate-500">{completedRate}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-600 uppercase mb-2">Failed</p>
          <p className="text-2xl font-bold text-red-600">{(campaign.stats?.failed || 0).toLocaleString()}</p>
        </Card>
      </div>

      {/* Campaign Details */}
      <Card className="p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Voice Configuration</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block text-xs text-slate-600 uppercase mb-2">Language</label>
            <p className="text-slate-900">{campaign.voiceConfig.language}</p>
          </div>
          <div>
            <label className="block text-xs text-slate-600 uppercase mb-2">Voice</label>
            <p className="text-slate-900">{campaign.voiceConfig.voice}</p>
          </div>
          <div>
            <label className="block text-xs text-slate-600 uppercase mb-2">Speed</label>
            <p className="text-slate-900">{campaign.voiceConfig.speed.toFixed(1)}x</p>
          </div>
        </div>
      </Card>

      {/* Script */}
      <Card className="p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Voice Script</h2>
        <div className="bg-slate-50 p-4 rounded border border-slate-200">
          <p className="text-slate-900 whitespace-pre-wrap">{campaign.script}</p>
        </div>
      </Card>

      {/* Call Log */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Call Log</h2>
          <select
            value={callFilter}
            onChange={(e) => setCallFilter(e.target.value)}
            className="px-3 py-1 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">All Statuses ({calls.length})</option>
            {Object.keys(callStatusColors).map(status => {
              const count = calls.filter(c => c.status === status).length;
              return (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {filteredCalls.length === 0 ? (
          <p className="text-center text-slate-600 py-8">
            {calls.length === 0 ? 'No calls yet' : 'No calls with this status'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-600">Phone</th>
                  <th className="px-4 py-2 text-left text-slate-600">Status</th>
                  <th className="px-4 py-2 text-left text-slate-600">Duration</th>
                  <th className="px-4 py-2 text-left text-slate-600">Sentiment</th>
                  <th className="px-4 py-2 text-left text-slate-600">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCalls.slice(0, 50).map(call => (
                  <tr key={call.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">{call.phone}</td>
                    <td className="px-4 py-2">
                      <Badge className={callStatusColors[call.status]}>
                        {call.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{call.duration ? `${call.duration}s` : '-'}</td>
                    <td className="px-4 py-2">
                      {call.sentiment && (
                        <Badge className={call.sentiment === 'positive' ? 'bg-green-100 text-green-800' : call.sentiment === 'negative' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'}>
                          {call.sentiment}
                        </Badge>
                      )}
                      {!call.sentiment && '-'}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{new Date(call.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCalls.length > 50 && (
              <p className="text-xs text-slate-600 mt-2">Showing 50 of {filteredCalls.length} calls</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
