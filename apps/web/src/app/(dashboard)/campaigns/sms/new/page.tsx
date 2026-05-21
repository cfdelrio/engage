"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { CampaignBuilderLayout } from "@/components/campaign/CampaignBuilderLayout";
import { TemplateVariables } from "@/components/campaign/TemplateVariables";
import { AudienceTargetingBuilder } from "@/components/campaign/AudienceTargetingBuilder";

interface SmsCampaignForm {
  name: string;
  description: string;
  body: string;
  fromNumber: string;
  audienceFilter: Record<string, unknown>;
}

export default function NewSmsCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [form, setForm] = useState<SmsCampaignForm>({
    name: "",
    description: "",
    body: "Hi {{user.firstName}}, check this out!",
    fromNumber: "",
    audienceFilter: {
      operator: "AND",
      conditions: [],
    },
  });

  const charCount = form.body.length;
  const smsCount = Math.ceil(charCount / 160);

  async function handleSave() {
    setErrors([]);

    if (!form.name.trim()) {
      setErrors((prev) => [...prev, "Campaign name is required"]);
      return;
    }
    if (!form.body.trim()) {
      setErrors((prev) => [...prev, "SMS message is required"]);
      return;
    }
    if (charCount > 1600) {
      setErrors((prev) => [
        ...prev,
        "Message is too long (max 1600 characters / 10 SMS)",
      ]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/sms-campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error(await res.text());

      const campaign = await res.json();
      router.push(`/campaigns/sms/${campaign.id}`);
    } catch (err) {
      setErrors([String(err).replace("Error: ", "")]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <CampaignBuilderLayout
      title="New SMS Campaign"
      onSave={handleSave}
      onCancel={() => router.back()}
      isLoading={loading}
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
                placeholder="Weekly Promo"
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

        {/* SMS Content */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">SMS Message</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-900">
                  Message
                </label>
                <div className="text-xs text-slate-500">
                  {charCount} chars • {smsCount} SMS{smsCount > 1 && "s"}
                </div>
              </div>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                rows={6}
                placeholder="Your SMS message here..."
                maxLength={1600}
              />
              <p className="text-xs text-slate-500 mt-1">
                Max 10 SMS (1600 chars). Supports Handlebars variables.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                From Number (Optional)
              </label>
              <input
                type="text"
                value={form.fromNumber}
                onChange={(e) =>
                  setForm({ ...form, fromNumber: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="+1234567890 (uses default if empty)"
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
