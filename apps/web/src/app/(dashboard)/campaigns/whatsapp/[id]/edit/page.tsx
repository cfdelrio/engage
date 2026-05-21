"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CampaignBuilderLayout } from "@/components/campaign/CampaignBuilderLayout";
import { TemplateVariables } from "@/components/campaign/TemplateVariables";
import { AudienceTargetingBuilder } from "@/components/campaign/AudienceTargetingBuilder";

interface WhatsAppCampaignForm {
  name: string;
  description: string;
  body: string;
  headerType: "text" | "image" | "document" | "video";
  headerValue: string;
  footerText: string;
  audienceFilter: Record<string, unknown>;
}

export default function EditWhatsAppCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [campaign, setCampaign] = useState<WhatsAppCampaignForm | null>(null);
  const [form, setForm] = useState<WhatsAppCampaignForm>({
    name: "",
    description: "",
    body: "",
    headerType: "text",
    headerValue: "",
    footerText: "",
    audienceFilter: { operator: "AND", conditions: [] },
  });

  useEffect(() => {
    fetchCampaign();
  }, [campaignId]);

  async function fetchCampaign() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/whatsapp-campaigns/${campaignId}`);
      if (!res.ok) throw new Error("Failed to load campaign");
      const data = await res.json();

      if (data.status !== "draft") {
        throw new Error("Only draft campaigns can be edited");
      }

      setCampaign(data);
      setForm({
        name: data.name || "",
        description: data.description || "",
        body: data.body || "",
        headerType: data.headerType || "text",
        headerValue: data.headerValue || "",
        footerText: data.footerText || "",
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
  }

  async function handleSave() {
    setErrors([]);

    if (!form.name.trim()) {
      setErrors((prev) => [...prev, "Campaign name is required"]);
      return;
    }
    if (!form.body.trim()) {
      setErrors((prev) => [...prev, "Message body is required"]);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/whatsapp-campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error(await res.text());

      router.push(`/campaigns/whatsapp/${campaignId}`);
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
      title={`Edit WhatsApp Campaign: ${form.name}`}
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
                placeholder="Holiday Promotion"
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

        {/* Message Header */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Message Header</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Header Type
              </label>
              <select
                value={form.headerType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    headerType: e.target.value as
                      | "text"
                      | "image"
                      | "document"
                      | "video",
                  })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              >
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="document">Document</option>
                <option value="video">Video</option>
              </select>
            </div>

            {form.headerType === "text" && (
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Header Text
                </label>
                <input
                  type="text"
                  value={form.headerValue}
                  onChange={(e) =>
                    setForm({ ...form, headerValue: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  placeholder="Your header text here"
                  maxLength={60}
                />
                <p className="text-xs text-slate-500 mt-1">Max 60 characters</p>
              </div>
            )}

            {form.headerType === "image" && (
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Image URL
                </label>
                <input
                  type="url"
                  value={form.headerValue}
                  onChange={(e) =>
                    setForm({ ...form, headerValue: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            )}

            {form.headerType === "document" && (
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Document URL
                </label>
                <input
                  type="url"
                  value={form.headerValue}
                  onChange={(e) =>
                    setForm({ ...form, headerValue: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  placeholder="https://example.com/document.pdf"
                />
              </div>
            )}

            {form.headerType === "video" && (
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Video URL
                </label>
                <input
                  type="url"
                  value={form.headerValue}
                  onChange={(e) =>
                    setForm({ ...form, headerValue: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  placeholder="https://example.com/video.mp4"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Message Body */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Message Body</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Message Text
              </label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                rows={6}
                placeholder="Your message here..."
              />
              <p className="text-xs text-slate-500 mt-1">
                Supports Handlebars variables
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Footer Text (Optional)
              </label>
              <input
                type="text"
                value={form.footerText}
                onChange={(e) =>
                  setForm({ ...form, footerText: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="Footer text appears at the bottom"
                maxLength={60}
              />
              <p className="text-xs text-slate-500 mt-1">Max 60 characters</p>
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
