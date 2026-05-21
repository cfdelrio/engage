'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CampaignBuilderLayout } from '@/components/campaign/CampaignBuilderLayout';
import { TemplateVariables } from '@/components/campaign/TemplateVariables';
import { AudienceTargetingBuilder } from '@/components/campaign/AudienceTargetingBuilder';

interface EmailCampaignForm {
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  audienceFilter: any;
}

export default function EditEmailCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [campaign, setCampaign] = useState<EmailCampaignForm | null>(null);
  const [form, setForm] = useState<EmailCampaignForm>({
    name: '',
    description: '',
    subject: '',
    bodyHtml: '',
    fromName: 'ORKESTAI',
    fromEmail: 'noreply@orkestai.com',
    replyTo: '',
    audienceFilter: { operator: 'AND', conditions: [] },
  });

  useEffect(() => {
    fetchCampaign();
  }, [campaignId]);

  async function fetchCampaign() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/email-campaigns/${campaignId}`);
      if (!res.ok) throw new Error('Failed to load campaign');
      const data = await res.json();

      // Only allow editing drafts
      if (data.status !== 'draft') {
        throw new Error('Only draft campaigns can be edited');
      }

      setCampaign(data);
      setForm({
        name: data.name || '',
        description: data.description || '',
        subject: data.subject || '',
        bodyHtml: data.bodyHtml || '',
        fromName: data.fromName || 'ORKESTAI',
        fromEmail: data.fromEmail || 'noreply@orkestai.com',
        replyTo: data.replyTo || '',
        audienceFilter: data.audienceFilter || { operator: 'AND', conditions: [] },
      });
    } catch (err) {
      setErrors([String(err).replace('Error: ', '')]);
    } finally {
      setLoading(false);
    }
  }

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

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/email-campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error(await res.text());

      router.push(`/campaigns/email/${campaignId}`);
    } catch (err) {
      setErrors([String(err).replace('Error: ', '')]);
    } finally {
      setSaving(false);
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
        <p className="text-red-600 mb-4">Campaign not found or cannot be edited</p>
        <Button onClick={() => router.back()} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <CampaignBuilderLayout
      title={`Edit Email Campaign: ${form.name}`}
      onSave={handleSave}
      onCancel={() => router.back()}
      isLoading={saving}
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
