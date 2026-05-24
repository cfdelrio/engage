"use client";

import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Save, Trash2, X } from "lucide-react";

interface FlowStep {
  id: string;
  type: "say" | "dtmf_question" | "speech_question" | "goodbye";
  text: string;
  options?: Record<string, string>;
  timeout?: number;
}

interface CampaignFormData {
  name: string;
  description: string;
  ttsProvider: "elevenlabs" | "openai";
  elevenLabsVoiceId: string;
  aiInstructions: string;
  triggerType: "manual" | "scheduled" | "rule-based" | "event-based";
  eventType?: string;
  flowSteps: FlowStep[];
}

const STEP_TYPE_LABELS: Record<FlowStep["type"], string> = {
  say: "Say",
  dtmf_question: "DTMF Question",
  speech_question: "Speech Question",
  goodbye: "Goodbye",
};

function newStep(): FlowStep {
  return { id: crypto.randomUUID(), type: "say", text: "" };
}

export function VoiceCampaignBuilder({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(!!campaignId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CampaignFormData>({
    name: "",
    description: "",
    ttsProvider: "elevenlabs",
    elevenLabsVoiceId: "",
    aiInstructions: "",
    triggerType: "manual",
    eventType: "",
    flowSteps: [newStep()],
  });

  useEffect(() => {
    if (!campaignId) return;

    const fetchCampaign = async () => {
      try {
        const response = await apiFetch(`/v1/voice-campaigns/${campaignId}`);
        if (!response.ok) throw new Error("Failed to fetch campaign");
        const campaign = await response.json();
        const storedSteps = Array.isArray(campaign.flowSteps)
          ? (campaign.flowSteps as FlowStep[])
          : [newStep()];
        setData({
          name: campaign.name ?? "",
          description: campaign.description ?? "",
          ttsProvider: campaign.ttsProvider ?? "elevenlabs",
          elevenLabsVoiceId: campaign.elevenLabsVoiceId ?? "",
          aiInstructions: campaign.aiInstructions ?? "",
          triggerType: campaign.triggerType ?? "manual",
          eventType: campaign.eventType ?? "",
          flowSteps: storedSteps.length > 0 ? storedSteps : [newStep()],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId]);

  const updateStep = (index: number, patch: Partial<FlowStep>) => {
    setData((prev) => {
      const steps = prev.flowSteps.map((s, i) =>
        i === index ? ({ ...s, ...patch } as FlowStep) : s,
      );
      return { ...prev, flowSteps: steps };
    });
  };

  const addStep = () => {
    setData((prev) => ({ ...prev, flowSteps: [...prev.flowSteps, newStep()] }));
  };

  const removeStep = (index: number) => {
    setData((prev) => {
      if (prev.flowSteps.length <= 1) return prev;
      return {
        ...prev,
        flowSteps: prev.flowSteps.filter((_, i) => i !== index),
      };
    });
  };

  const setStepOption = (stepIndex: number, key: string, value: string) => {
    const step = data.flowSteps[stepIndex];
    if (!step) return;
    updateStep(stepIndex, {
      options: { ...(step.options ?? {}), [key]: value },
    });
  };

  const addStepOption = (stepIndex: number) => {
    const step = data.flowSteps[stepIndex];
    if (!step) return;
    const existing = Object.keys(step.options ?? {});
    const next = String(existing.length + 1);
    if (!existing.includes(next)) setStepOption(stepIndex, next, "");
  };

  const removeStepOption = (stepIndex: number, key: string) => {
    const step = data.flowSteps[stepIndex];
    if (!step) return;
    const options = { ...(step.options ?? {}) };
    delete options[key];
    updateStep(stepIndex, { options });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim()) {
      setError("Campaign name is required");
      return;
    }
    if (data.flowSteps.some((s) => !s.text.trim())) {
      setError("All steps must have text");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const method = campaignId ? "PUT" : "POST";
      const url = campaignId
        ? `/v1/voice-campaigns/${campaignId}`
        : `/v1/voice-campaigns`;

      const payload = {
        name: data.name,
        description: data.description || undefined,
        ttsProvider: data.ttsProvider,
        elevenLabsVoiceId: data.elevenLabsVoiceId || undefined,
        aiInstructions: data.aiInstructions || undefined,
        triggerType: data.triggerType,
        eventType: data.eventType || undefined,
        flowSteps: data.flowSteps,
      };

      const response = await apiFetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to save campaign");
      }

      router.push("/voice-campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4">Loading campaign...</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Campaign Name *</Label>
              <Input
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                placeholder="e.g., Survey Campaign"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Trigger Type</Label>
              <Select
                value={data.triggerType}
                onValueChange={(value) =>
                  setData({
                    ...data,
                    triggerType: value as
                      | "manual"
                      | "scheduled"
                      | "rule-based"
                      | "event-based",
                    eventType: value !== "event-based" ? "" : data.eventType,
                  })
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="rule-based">Rule-Based</SelectItem>
                  <SelectItem value="event-based">Event-Based</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {data.triggerType === "event-based" && (
            <div>
              <Label>Event Type *</Label>
              <Input
                value={data.eventType}
                onChange={(e) =>
                  setData({ ...data, eventType: e.target.value })
                }
                placeholder="e.g., user.signup, order.completed"
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The exact event name that triggers this campaign
              </p>
            </div>
          )}
          <div>
            <Label>Description</Label>
            <Textarea
              value={data.description}
              onChange={(e) =>
                setData({ ...data, description: e.target.value })
              }
              placeholder="Optional campaign description"
              className="mt-2 min-h-16"
            />
          </div>
        </CardContent>
      </Card>

      {/* TTS Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">TTS Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Voice Service</Label>
            <Select value="orkestai-voice" onValueChange={() => {}}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orkestai-voice">
                  orkestai-voice (voice.orkestai.com.ar)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>TTS Provider</Label>
            <Select
              value={data.ttsProvider}
              onValueChange={(value) =>
                setData({
                  ...data,
                  ttsProvider: value as "elevenlabs" | "openai",
                })
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {data.ttsProvider === "elevenlabs" && (
            <div>
              <Label>ElevenLabs Voice ID</Label>
              <Input
                value={data.elevenLabsVoiceId}
                onChange={(e) =>
                  setData({ ...data, elevenLabsVoiceId: e.target.value })
                }
                placeholder="p7AwDmKvTdoHTBuueGvP"
                className="mt-2 font-mono text-sm"
              />
            </div>
          )}

          <div>
            <Label>Voice Instructions</Label>
            <Textarea
              value={data.aiInstructions}
              onChange={(e) =>
                setData({ ...data, aiInstructions: e.target.value })
              }
              placeholder="Hablar con entusiasmo deportivo, tono amigable"
              className="mt-2 min-h-16"
            />
          </div>
        </CardContent>
      </Card>

      {/* Call Flow */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Call Flow</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus className="h-4 w-4 mr-1" />
            Add Step
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.flowSteps.map((step, index) => (
            <div
              key={step.id}
              className="border rounded-lg p-4 space-y-3 bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground w-6">
                  {index + 1}.
                </span>
                <Select
                  value={step.type}
                  onValueChange={(value) =>
                    updateStep(index, {
                      type: value as FlowStep["type"],
                      options: value === "dtmf_question" ? {} : undefined,
                    })
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(STEP_TYPE_LABELS) as [
                        FlowStep["type"],
                        string,
                      ][]
                    ).map(([type, label]) => (
                      <SelectItem key={type} value={type}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1" />
                {data.flowSteps.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStep(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div>
                <Label className="text-xs">Text *</Label>
                <Textarea
                  value={step.text}
                  onChange={(e) => updateStep(index, { text: e.target.value })}
                  placeholder={
                    step.type === "goodbye"
                      ? "Gracias por tu tiempo. ¡Hasta pronto!"
                      : step.type === "dtmf_question"
                        ? "Presioná 1 para Sí, 2 para No"
                        : "Hola, te llamamos de ORKESTAI..."
                  }
                  className="mt-1 min-h-16 text-sm"
                />
              </div>

              {step.type === "dtmf_question" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">DTMF Options</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => addStepOption(index)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Option
                    </Button>
                  </div>
                  {Object.entries(step.options ?? {}).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-muted rounded px-2 py-1 w-8 text-center">
                        {key}
                      </span>
                      <Input
                        value={value}
                        onChange={(e) =>
                          setStepOption(index, key, e.target.value)
                        }
                        placeholder="e.g., Sí"
                        className="h-7 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground"
                        onClick={() => removeStepOption(index, key)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {(step.type === "dtmf_question" ||
                step.type === "speech_question") && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">
                    Timeout (s)
                  </Label>
                  <Input
                    type="number"
                    min="3"
                    max="30"
                    value={step.timeout ?? 10}
                    onChange={(e) =>
                      updateStep(index, { timeout: parseInt(e.target.value) })
                    }
                    className="h-7 w-20 text-xs"
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : campaignId ? "Update" : "Create"} Campaign
        </Button>
      </div>
    </form>
  );
}
