'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CampaignBuilderLayout } from '@/components/campaign/CampaignBuilderLayout';
import { TemplateVariables } from '@/components/campaign/TemplateVariables';

export default function NewEmailCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    subject: '',
    bodyHtml: '<p>Hello {{user.firstName}},</p>\n<p>Your message here.</p>',
    fromName: 'ORKESTAI',
    fromEmail: 'noreply@orkestai.com',
    replyTo: '',
  });

  async function handleSave() {
    setErrors([]);

    if (!form.name.trim()) {
      setErrors(prev => [...prev, 'Campaign name is required']);
      return;
    }
    if (!form.subject.trim()) {
      setErrors(prev => [...prev, 'Email subject is required']);
      return;
    }
    if (!form.bodyHtml.trim()) {
      setErrors(prev => [...prev, 'Email body is required']);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/email-campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error(await res.text());

      const campaign = await res.json();
      router.push(`/campaigns/email/${campaign.id}`);
    } catch (err) {
      setErrors([String(err).replace('Error: ', '')]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <CampaignBuilderLayout
      title="New Email Campaign"
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
                placeholder="Q2 Product Launch"
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

        {/* Email Content */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Email Content</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Subject Line</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="Welcome {{user.firstName}}!"
              />
              <p className="text-xs text-slate-500 mt-1">Supports Handlebars variables</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Email Body (HTML)</label>
              <textarea
                value={form.bodyHtml}
                onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                rows={10}
                placeholder="<p>Your HTML content here</p>"
              />
              <p className="text-xs text-slate-500 mt-1">HTML content with Handlebars support</p>
            </div>
          </div>
        </Card>

        {/* Email Settings */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Email Settings</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">From Name</label>
                <input
                  type="text"
                  value={form.fromName}
                  onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">From Email</label>
                <input
                  type="email"
                  value={form.fromEmail}
                  onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Reply-To Email</label>
              <input
                type="email"
                value={form.replyTo}
                onChange={(e) => setForm({ ...form, replyTo: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="support@example.com"
              />
            </div>
          </div>
        </Card>

        {/* Template Variables */}
        <TemplateVariables />
      </div>
    </CampaignBuilderLayout>
  );
}
