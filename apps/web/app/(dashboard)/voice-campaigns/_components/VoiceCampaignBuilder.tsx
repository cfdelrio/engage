"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Save } from "lucide-react";
import { useApiKey } from "@/hooks/useApiKey";

interface VoiceCampaignData {
  name: string;
  description?: string;
  script: string;
  triggerType: "manual" | "scheduled" | "rule-based";
  voiceConfig: {
    language: string;
    gender: "male" | "female";
    speed: number;
  };
  dtmfConfig: {
    enabled: boolean;
    options?: Array<{ key: string; label: string; action?: string }>;
  };
  aiGenerated: boolean;
  aiInstructions?: string;
  maxRetries: number;
}

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
const LANGUAGE_OPTIONS = [
  { label: "Spanish (ES)", value: "es-ES" },
  { label: "Spanish (MX)", value: "es-MX" },
  { label: "English (US)", value: "en-US" },
  { label: "English (GB)", value: "en-GB" },
  { label: "Portuguese (BR)", value: "pt-BR" },
];

const DTMF_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#"];

export function VoiceCampaignBuilder() {
  const router = useRouter();
  const apiKey = useApiKey();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VoiceCampaignData>({
    name: "",
    script: "Hola {{user.firstName}}, este es un mensaje de ORKESTAI ENGAGE.",
    triggerType: "manual",
    voiceConfig: {
      language: "es-ES",
      gender: "female",
      speed: 1,
    },
    dtmfConfig: {
      enabled: false,
      options: [],
    },
    aiGenerated: false,
    maxRetries: 2,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim() || !data.script.trim()) {
      setError("Campaign name and script are required");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/v1/voice-campaigns`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to create campaign");
      }

      router.push("/voice-campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const addDtmfOption = () => {
    setData((prev) => ({
      ...prev,
      dtmfConfig: {
        ...prev.dtmfConfig,
        options: [
          ...(prev.dtmfConfig?.options || []),
          { key: "", label: "", action: "" },
        ],
      },
    }));
  };

  const removeDtmfOption = (index: number) => {
    setData((prev) => ({
      ...prev,
      dtmfConfig: {
        ...prev.dtmfConfig,
        options: (prev.dtmfConfig?.options || []).filter((_, i) => i !== index),
      },
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="script">Script</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="dtmf">DTMF</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  placeholder="e.g., Reactivation Campaign"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={data.description || ""}
                  onChange={(e) =>
                    setData({ ...data, description: e.target.value })
                  }
                  placeholder="Optional description"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="triggerType">Trigger Type</Label>
                <Select
                  value={data.triggerType}
                  onValueChange={(value) =>
                    setData({
                      ...data,
                      triggerType: value as VoiceCampaignData["triggerType"],
                    })
                  }
                >
                  <SelectTrigger id="triggerType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="rule-based">Rule-based</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="maxRetries">Max Retries</Label>
                <Select
                  value={String(data.maxRetries)}
                  onValueChange={(value) =>
                    setData({ ...data, maxRetries: parseInt(value) })
                  }
                >
                  <SelectTrigger id="maxRetries">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? "retry" : "retries"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="script" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Voice Script</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="script">Script *</Label>
                <Textarea
                  id="script"
                  value={data.script}
                  onChange={(e) => setData({ ...data, script: e.target.value })}
                  placeholder="Enter voice script. Use {{user.firstName}}, {{user.email}} etc."
                  rows={8}
                  required
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Available variables: {"{{user.firstName}}"} {"{{user.email}}"}{" "}
                  {"{{user.phone}}"}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Preview:</p>
                    <p>{data.script}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Voice Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="language">Language</Label>
                <Select
                  value={data.voiceConfig.language}
                  onValueChange={(value) =>
                    setData({
                      ...data,
                      voiceConfig: { ...data.voiceConfig, language: value },
                    })
                  }
                >
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="gender">Voice Gender</Label>
                <Select
                  value={data.voiceConfig.gender}
                  onValueChange={(value) =>
                    setData({
                      ...data,
                      voiceConfig: {
                        ...data.voiceConfig,
                        gender: value as "male" | "female",
                      },
                    })
                  }
                >
                  <SelectTrigger id="gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="speed">
                  Voice Speed: {data.voiceConfig.speed.toFixed(1)}x
                </Label>
                <input
                  id="speed"
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={data.voiceConfig.speed}
                  onChange={(e) =>
                    setData({
                      ...data,
                      voiceConfig: {
                        ...data.voiceConfig,
                        speed: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dtmf" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>DTMF Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="dtmfEnabled"
                  checked={data.dtmfConfig?.enabled || false}
                  onChange={(e) =>
                    setData({
                      ...data,
                      dtmfConfig: {
                        ...data.dtmfConfig,
                        enabled: e.target.checked,
                      },
                    })
                  }
                />
                <Label htmlFor="dtmfEnabled" className="font-medium">
                  Enable DTMF responses
                </Label>
              </div>

              {data.dtmfConfig?.enabled && (
                <div className="space-y-3">
                  {(data.dtmfConfig?.options || []).map((option, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <Select
                        value={option.key}
                        onValueChange={(value) => {
                          const opts = [...(data.dtmfConfig?.options || [])];
                          opts[index].key = value;
                          setData({
                            ...data,
                            dtmfConfig: { ...data.dtmfConfig, options: opts },
                          });
                        }}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue placeholder="Key" />
                        </SelectTrigger>
                        <SelectContent>
                          {DTMF_KEYS.map((key) => (
                            <SelectItem key={key} value={key}>
                              {key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Label (e.g., Confirm)"
                        value={option.label}
                        onChange={(e) => {
                          const opts = [...(data.dtmfConfig?.options || [])];
                          opts[index].label = e.target.value;
                          setData({
                            ...data,
                            dtmfConfig: { ...data.dtmfConfig, options: opts },
                          });
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeDtmfOption(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addDtmfOption}
                    className="w-full"
                  >
                    Add DTMF Option
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-900">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="gap-2">
          <Save className="h-4 w-4" />
          {loading ? "Creating..." : "Create Campaign"}
        </Button>
      </div>
    </form>
  );
}
