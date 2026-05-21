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
import { Plus, Play, Pause, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';

interface EmailCampaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  stats: { sent: number; delivered: number; opened: number; failed: number };
  createdAt: string;
}

const mockCampaigns: EmailCampaign[] = [
  {
    id: '1',
    name: 'Q2 Product Launch',
    description: 'Announcement of new features',
    status: 'active',
    stats: { sent: 2450, delivered: 2450, opened: 1225, failed: 0 },
    createdAt: '2026-05-20',
  },
  {
    id: '2',
    name: 'Newsletter May',
    description: 'Monthly digest',
    status: 'completed',
    stats: { sent: 5000, delivered: 4950, opened: 2475, failed: 50 },
    createdAt: '2026-05-15',
  },
];

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
};

export default function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>(mockCampaigns);
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Email Campaigns</h1>
          <p className="text-slate-600 mt-2">Create and manage your email marketing campaigns</p>
        </div>
        <Button className="gap-2">
          <Plus size={20} />
          New Campaign
        </Button>
      </div>

      <Card className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Sent</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Open Rate</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
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
                <TableCell className="text-right">{campaign.stats.sent.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  {((campaign.stats.delivered / campaign.stats.sent) * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-right">
                  {((campaign.stats.opened / campaign.stats.sent) * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/campaigns/email/${campaign.id}`}>
                      <Button variant="outline" size="icon">
                        <Eye size={16} />
                      </Button>
                    </Link>
                    {campaign.status === 'draft' && (
                      <Button variant="outline" size="icon">
                        <Play size={16} />
                      </Button>
                    )}
                    {campaign.status === 'active' && (
                      <Button variant="outline" size="icon">
                        <Pause size={16} />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
