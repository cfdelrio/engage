'use client';

import { useState } from 'react';
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

interface PushCampaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  stats: { sent: number; delivered: number; opened: number; failed: number };
  createdAt: string;
}

const mockCampaigns: PushCampaign[] = [
  {
    id: '1',
    name: 'Weekend Reminder',
    status: 'active',
    stats: { sent: 3000, delivered: 2850, opened: 1710, failed: 150 },
    createdAt: '2026-05-20',
  },
  {
    id: '2',
    name: 'App Update Alert',
    status: 'completed',
    stats: { sent: 2500, delivered: 2450, opened: 1225, failed: 50 },
    createdAt: '2026-05-15',
  },
];

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
};

export default function PushCampaignsPage() {
  const [campaigns] = useState<PushCampaign[]>(mockCampaigns);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Push Notifications</h1>
          <p className="text-slate-600 mt-2">Create and manage push notification campaigns</p>
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
                <TableCell className="font-medium text-slate-900">{campaign.name}</TableCell>
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
                    <Link href={`/campaigns/push/${campaign.id}`}>
                      <Button variant="outline" size="icon">
                        <Eye size={16} />
                      </Button>
                    </Link>
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
