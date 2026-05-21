"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CampaignBuilderLayout } from "@/components/campaign/CampaignBuilderLayout";
import { AudienceTargetingBuilder } from "@/components/campaign/AudienceTargetingBuilder";
import { TemplateVariables } from "@/components/campaign/TemplateVariables";
import { Plus, Trash2 } from "lucide-react";

interface DTMFOption {
  key: string;
  label: string;
}

interface VoiceCampaignForm {
  name: string;
  description: string;
  script: string;
  voiceConfig: {
    language: string;
    voice: "male" | "female";
    speed: number;
  };
  audienceFilter: Record<string, unknown>;
}

export default function NewVoiceCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dtmfEnabled, setDtmfEnabled] = useState(false);
  const [dtmfOptions, setDtmfOptions] = useState<DTMFOption[]>([]);
  const [form, setForm] = useState<VoiceCampaignForm>({
    name: "",
    description: "",
    script:
      "Hello {{user.firstName}}, this is an important message. Please listen carefully.",
    voiceConfig: {
      language: "es-ES",
      voice: "female" as "male" | "female",
      speed: 1.0,
    },
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
    if (!form.script.trim()) {
      setErrors((prev) => [...prev, "Voice script is required"]);
      return;
    }

    const dtmfConfig = dtmfEnabled
      ? {
          enabled: true,
          options: dtmfOptions,
        }
      : undefined;

    setLoading(true);
    try {
      const res = await fetch("/api/v1/voice-campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          dtmfConfig,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const campaign = await res.json();
      router.push(`/campaigns/voice/${campaign.id}`);
    } catch (err) {
      setErrors([String(err).replace("Error: ", "")]);
    } finally {
      setLoading(false);
    }
  }

  const addDTMFOption = () => {
    setDtmfOptions([...dtmfOptions, { key: "", label: "" }]);
  };

  const removeDTMFOption = (idx: number) => {
    setDtmfOptions(dtmfOptions.filter((_, i) => i !== idx));
  };

  const updateDTMFOption = (
    idx: number,
    field: keyof DTMFOption,
    value: string,
  ) => {
    const updated = [...dtmfOptions];
    const option = updated[idx];
    if (option) {
      option[field] = value;
      setDtmfOptions(updated);
    }
  };

  return (
    <CampaignBuilderLayout
      title="New Voice Campaign"
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
                placeholder="Support Follow-up Calls"
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

        {/* Voice Script */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Voice Script</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Script Text
              </label>
              <textarea
                value={form.script}
                onChange={(e) => setForm({ ...form, script: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                rows={6}
                placeholder="What Twilio will read to the user..."
              />
              <p className="text-xs text-slate-500 mt-1">
                Natural language script. Supports Handlebars variables.
              </p>
            </div>
          </div>
        </Card>

        {/* Voice Config */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Voice Settings</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Language
                </label>
                <select
                  value={form.voiceConfig.language}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      voiceConfig: {
                        ...form.voiceConfig,
                        language: e.target.value,
                      },
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="es-ES">Spanish (Spain)</option>
                  <option value="es-MX">Spanish (Mexico)</option>
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="pt-BR">Portuguese (Brazil)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Voice Gender
                </label>
                <select
                  value={form.voiceConfig.voice}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      voiceConfig: {
                        ...form.voiceConfig,
                        voice: e.target.value as "male" | "female",
                      },
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Speed
                </label>
                <input
                  type="number"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={form.voiceConfig.speed}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      voiceConfig: {
                        ...form.voiceConfig,
                        speed: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* DTMF Config */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">
              DTMF Options (Phone Key Presses)
            </h2>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={dtmfEnabled}
                onChange={(e) => setDtmfEnabled(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-600">Enable DTMF</span>
            </label>
          </div>

          {dtmfEnabled && (
            <div className="space-y-4">
              {dtmfOptions.map((opt, idx) => (
                <div key={idx} className="flex gap-3 items-end">
                  <div className="flex-shrink-0">
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Key
                    </label>
                    <input
                      type="text"
                      maxLength={1}
                      value={opt.key}
                      onChange={(e) =>
                        updateDTMFOption(
                          idx,
                          "key",
                          e.target.value.toUpperCase(),
                        )
                      }
                      className="w-16 px-3 py-2 border border-slate-300 rounded-lg text-center font-mono"
                      placeholder="1"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Label
                    </label>
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) =>
                        updateDTMFOption(idx, "label", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="e.g., 'Press for more options'"
                    />
                  </div>
                  <button
                    onClick={() => removeDTMFOption(idx)}
                    className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={addDTMFOption}
                className="w-full gap-2 mt-4"
              >
                <Plus size={18} />
                Add DTMF Option
              </Button>
            </div>
          )}
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
