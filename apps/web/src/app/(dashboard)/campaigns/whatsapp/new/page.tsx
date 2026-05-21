"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CampaignBuilderLayout } from "@/components/campaign/CampaignBuilderLayout";
import { AudienceTargetingBuilder } from "@/components/campaign/AudienceTargetingBuilder";
import { TemplateVariables } from "@/components/campaign/TemplateVariables";
import { Plus, Trash2 } from "lucide-react";

interface WhatsAppButton {
  id: string;
  title: string;
}

interface WhatsAppCampaignForm {
  name: string;
  description: string;
  body: string;
  headerType: "text" | "image" | "document" | "video";
  headerValue: string;
  footerText: string;
  audienceFilter: Record<string, unknown>;
}

export default function NewWhatsAppCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [buttons, setButtons] = useState<WhatsAppButton[]>([]);
  const [form, setForm] = useState<WhatsAppCampaignForm>({
    name: "",
    description: "",
    body: "Hi {{user.firstName}}, check this out!",
    headerType: "text" as "text" | "image" | "document" | "video",
    headerValue: "",
    footerText: "",
    audienceFilter: {
      operator: "AND",
      conditions: [],
    },
  });

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

    setLoading(true);
    try {
      const res = await fetch("/api/v1/whatsapp-campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          buttons,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const campaign = await res.json();
      router.push(`/campaigns/whatsapp/${campaign.id}`);
    } catch (err) {
      setErrors([String(err).replace("Error: ", "")]);
    } finally {
      setLoading(false);
    }
  }

  const addButton = () => {
    setButtons([...buttons, { id: `btn_${Date.now()}`, title: "" }]);
  };

  const removeButton = (idx: number) => {
    setButtons(buttons.filter((_, i) => i !== idx));
  };

  const updateButton = (
    idx: number,
    field: keyof WhatsAppButton,
    value: string,
  ) => {
    const updated = [...buttons];
    const button = updated[idx];
    if (button) {
      button[field] = value;
      setButtons(updated);
    }
  };

  return (
    <CampaignBuilderLayout
      title="New WhatsApp Campaign"
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
                maxLength={4096}
              />
              <p className="text-xs text-slate-500 mt-1">
                Max 4096 characters. Supports Handlebars variables.
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
                placeholder="e.g., 'Reply STOP to unsubscribe'"
                maxLength={60}
              />
              <p className="text-xs text-slate-500 mt-1">Max 60 characters</p>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">
              Action Buttons (Optional)
            </h2>
            <span className="text-xs text-slate-600">{buttons.length} / 3</span>
          </div>

          {buttons.length > 0 && (
            <div className="space-y-3 mb-4">
              {buttons.map((btn, idx) => (
                <div key={btn.id} className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Button {idx + 1} Title
                    </label>
                    <input
                      type="text"
                      value={btn.title}
                      onChange={(e) =>
                        updateButton(idx, "title", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="e.g., 'View Details'"
                      maxLength={20}
                    />
                  </div>
                  <button
                    onClick={() => removeButton(idx)}
                    className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {buttons.length < 3 && (
            <Button
              variant="outline"
              onClick={addButton}
              className="w-full gap-2"
            >
              <Plus size={18} />
              Add Button
            </Button>
          )}

          <p className="text-xs text-slate-500 mt-3">
            Add up to 3 action buttons. Each button can trigger different
            workflows.
          </p>
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
