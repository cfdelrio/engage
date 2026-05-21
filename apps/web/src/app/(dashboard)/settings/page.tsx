'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Check } from 'lucide-react';

export default function SettingsPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const apiKeys = [
    {
      id: '1',
      name: 'Production Key',
      prefix: 'sk_prod_...',
      lastUsed: '2026-05-20',
      status: 'active',
    },
    {
      id: '2',
      name: 'Development Key',
      prefix: 'sk_dev_...',
      lastUsed: '2026-05-19',
      status: 'active',
    },
  ];

  const channels = [
    { name: 'Email', provider: 'Resend', status: 'configured' },
    { name: 'SMS', provider: 'Twilio', status: 'configured' },
    { name: 'Push', provider: 'Firebase FCM', status: 'configured' },
    { name: 'Voice', provider: 'Twilio', status: 'configured' },
    { name: 'WhatsApp', provider: 'Twilio', status: 'configured' },
  ];

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-2">Manage your account and integration settings</p>
      </div>

      {/* Channel Configuration */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Channel Providers</h2>
        <div className="grid gap-4">
          {channels.map((channel) => (
            <Card key={channel.name} className="p-6 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{channel.name}</p>
                <p className="text-sm text-slate-500">{channel.provider}</p>
              </div>
              <Badge className="bg-green-100 text-green-800">{channel.status}</Badge>
            </Card>
          ))}
        </div>
      </div>

      {/* API Keys */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">API Keys</h2>
          <Button>Generate New Key</Button>
        </div>
        <div className="space-y-4">
          {apiKeys.map((key) => (
            <Card key={key.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{key.name}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="text-sm bg-slate-100 px-3 py-1 rounded text-slate-700">
                      {key.prefix}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(key.prefix)}
                    >
                      {copiedKey === key.prefix ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Last used: {key.lastUsed}</p>
                </div>
                <div className="text-right">
                  <Badge
                    className={
                      key.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-slate-100 text-slate-800'
                    }
                  >
                    {key.status}
                  </Badge>
                  <Button variant="outline" className="mt-4">
                    Revoke
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Tenant Settings */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Tenant Settings</h2>
        <Card className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Tenant Name</label>
            <input
              type="text"
              value="ProdeCaballito"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Tenant Slug</label>
            <input
              type="text"
              value="prodecaballito"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Plan</label>
            <input
              type="text"
              value="Enterprise"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              disabled
            />
          </div>
          <Button>Save Changes</Button>
        </Card>
      </div>
    </div>
  );
}
