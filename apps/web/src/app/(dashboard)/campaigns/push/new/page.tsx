'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CampaignBuilderLayout } from '@/components/campaign/CampaignBuilderLayout';
import { AudienceTargetingBuilder } from '@/components/campaign/AudienceTargetingBuilder';
import { TemplateVariables } from '@/components/campaign/TemplateVariables';

interface PushCampaignForm {
  name: string;
  description: string;
  title: string;
  body: string;
  imageUrl: string;
  actionUrl: string;
  priority: 'high' | 'normal';
  audienceFilter: any;
}

export default function NewPushCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [form, setForm] = useState<PushCampaignForm>({
    name: '',
    description: '',
    title: 'Hello {{user.firstName}}!',
    body: 'Tap to learn more about our latest updates.',
    imageUrl: '',
    actionUrl: '',
    priority: 'high' as 'high' | 'normal',
    audienceFilter: {
      operator: 'AND',
      conditions: [],
    },
  });

  async function handleSave() {
    setErrors([]);

    if (!form.name.trim()) {
      setErrors(prev => [...prev, 'Campaign name is required']);
      return;
    }
    if (!form.title.trim()) {
      setErrors(prev => [...prev, 'Push title is required']);
      return;
    }
    if (!form.body.trim()) {
      setErrors(prev => [...prev, 'Push message body is required']);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/push-campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error(await res.text());

      const campaign = await res.json();
      router.push(`/campaigns/push/${campaign.id}`);
    } catch (err) {
      setErrors([String(err).replace('Error: ', '')]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <CampaignBuilderLayout
      title="New Push Campaign"
      onSave={handleSave}
      onCancel={() => router.back()}
      isLoading={loading}
      errors={errors}
    >
      <div className="space-y-6">
        {/* Campaign Info */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Campaign Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Campaign Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="App Update Alert"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                rows={2}
                placeholder="Optional description"
              />
            </div>
          </div>
        </Card>

        {/* Push Content */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Push Notification</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="Notification title"
              />
              <p className="text-xs text-slate-500 mt-1">Supports Handlebars variables</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Message Body</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                rows={4}
                placeholder="Notification body text"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Image URL (Optional)</label>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Action URL (Optional)</label>
              <input
                type="url"
                value={form.actionUrl}
                onChange={(e) => setForm({ ...form, actionUrl: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="https://example.com/promo"
              />
              <p className="text-xs text-slate-500 mt-1">URL to open when user taps notification</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as 'high' | 'normal' })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              >
                <option value="high">High (immediate delivery)</option>
                <option value="normal">Normal (batched delivery)</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Audience Targeting */}
        <Card className="p-6">
          <AudienceTargetingBuilder
            value={form.audienceFilter}
            onChange={(audienceFilter) => setForm({ ...form, audienceFilter })}
          />
        </Card>

        {/* Template Variables */}
        <TemplateVariables />
      </div>
    </CampaignBuilderLayout>
  );
}
