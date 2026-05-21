"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CampaignBuilderLayout } from "@/components/campaign/CampaignBuilderLayout";
import { TemplateVariables } from "@/components/campaign/TemplateVariables";
import { AudienceTargetingBuilder } from "@/components/campaign/AudienceTargetingBuilder";

interface PushCampaignForm {
  name: string;
  description: string;
  title: string;
  body: string;
  imageUrl: string;
  actionUrl: string;
  priority: "high" | "normal";
  audienceFilter: Record<string, unknown>;
}

export default function EditPushCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [campaign, setCampaign] = useState<PushCampaignForm | null>(null);
  const [form, setForm] = useState<PushCampaignForm>({
    name: "",
    description: "",
    title: "",
    body: "",
    imageUrl: "",
    actionUrl: "",
    priority: "high",
    audienceFilter: { operator: "AND", conditions: [] },
  });

  const fetchCampaign = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/push-campaigns/${campaignId}`);
      if (!res.ok) throw new Error("Failed to load campaign");
      const data = await res.json();

      if (data.status !== "draft") {
        throw new Error("Only draft campaigns can be edited");
      }

      setCampaign(data);
      setForm({
        name: data.name || "",
        description: data.description || "",
        title: data.title || "",
        body: data.body || "",
        imageUrl: data.imageUrl || "",
        actionUrl: data.actionUrl || "",
        priority: data.priority || "high",
        audienceFilter: data.audienceFilter || {
          operator: "AND",
          conditions: [],
        },
      });
    } catch (err) {
      setErrors([String(err).replace("Error: ", "")]);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  async function handleSave() {
    setErrors([]);

    if (!form.name.trim()) {
      setErrors((prev) => [...prev, "Campaign name is required"]);
      return;
    }
    if (!form.title.trim()) {
      setErrors((prev) => [...prev, "Push title is required"]);
      return;
    }
    if (!form.body.trim()) {
      setErrors((prev) => [...prev, "Push message body is required"]);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/push-campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error(await res.text());

      router.push(`/campaigns/push/${campaignId}`);
    } catch (err) {
      setErrors([String(err).replace("Error: ", "")]);
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
        <p className="text-red-600 mb-4">
          Campaign not found or cannot be edited
        </p>
        <Button onClick={() => router.back()} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <CampaignBuilderLayout
      title={`Edit Push Campaign: ${form.name}`}
      onSave={handleSave}
      onCancel={() => router.back()}
      isLoading={saving}
      errors={errors}
    >
      <div className="space-y-6">
        {/* Campaign Info */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">
            Campaign Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Campaign Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="App Update Alert"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                rows={2}
                placeholder="Optional description"
              />
            </div>
          </div>
        </Card>

        {/* Push Content */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">
            Push Notification
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="Notification title"
              />
              <p className="text-xs text-slate-500 mt-1">
                Supports Handlebars variables
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Message Body
              </label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                rows={4}
                placeholder="Notification body text"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Image URL (Optional)
              </label>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Action URL (Optional)
              </label>
              <input
                type="url"
                value={form.actionUrl}
                onChange={(e) =>
                  setForm({ ...form, actionUrl: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="https://example.com/promo"
              />
              <p className="text-xs text-slate-500 mt-1">
                URL to open when user taps notification
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priority: e.target.value as "high" | "normal",
                  })
                }
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
            onChange={(audienceFilter) =>
              setForm({
                ...form,
                audienceFilter: audienceFilter as unknown as Record<
                  string,
                  unknown
                >,
              })
            }
          />
        </Card>

        {/* Template Variables */}
        <TemplateVariables />
      </div>
    </CampaignBuilderLayout>
  );
}
