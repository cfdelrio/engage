'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CampaignBuilderLayout } from '@/components/campaign/CampaignBuilderLayout';
import { TemplateVariables } from '@/components/campaign/TemplateVariables';
import { AudienceTargetingBuilder } from '@/components/campaign/AudienceTargetingBuilder';

interface VoiceCampaignForm {
  name: string;
  description: string;
  script: string;
  voiceConfig: {
    language: string;
    voice: 'male' | 'female';
    speed: number;
  };
  audienceFilter: any;
}

export default function EditVoiceCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [campaign, setCampaign] = useState<VoiceCampaignForm | null>(null);
  const [form, setForm] = useState<VoiceCampaignForm>({
    name: '',
    description: '',
    script: '',
    voiceConfig: {
      language: 'es-ES',
      voice: 'female',
      speed: 1.0,
    },
    audienceFilter: { operator: 'AND', conditions: [] },
  });

  useEffect(() => {
    fetchCampaign();
  }, [campaignId]);

  async function fetchCampaign() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/voice-campaigns/${campaignId}`);
      if (!res.ok) throw new Error('Failed to load campaign');
      const data = await res.json();

      if (data.status !== 'draft') {
        throw new Error('Only draft campaigns can be edited');
      }

      setCampaign(data);
      setForm({
        name: data.name || '',
        description: data.description || '',
        script: data.script || '',
        voiceConfig: data.voiceConfig || {
          language: 'es-ES',
          voice: 'female',
          speed: 1.0,
        },
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
    if (!form.script.trim()) {
      setErrors(prev => [...prev, 'Voice script is required']);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/voice-campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error(await res.text());

      router.push(`/campaigns/voice/${campaignId}`);
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
      title={`Edit Voice Campaign: ${form.name}`}
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
                placeholder="Reactivation Campaign"
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

        {/* Voice Script */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Voice Script</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Script Text</label>
              <textarea
                value={form.script}
                onChange={(e) => setForm({ ...form, script: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                rows={8}
                placeholder="Hello {{user.firstName}}, this is an important message..."
              />
              <p className="text-xs text-slate-500 mt-1">Supports Handlebars variables</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Language</label>
                <select
                  value={form.voiceConfig.language}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      voiceConfig: { ...form.voiceConfig, language: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="es-ES">Spanish (Spain)</option>
                  <option value="es-MX">Spanish (Mexico)</option>
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (GB)</option>
                  <option value="fr-FR">French</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Voice Gender</label>
                <select
                  value={form.voiceConfig.voice}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      voiceConfig: { ...form.voiceConfig, voice: e.target.value as 'male' | 'female' },
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Speed</label>
                <input
                  type="number"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={form.voiceConfig.speed}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      voiceConfig: { ...form.voiceConfig, speed: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
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
