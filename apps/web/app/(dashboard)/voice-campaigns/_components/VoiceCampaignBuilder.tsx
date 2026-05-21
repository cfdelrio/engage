"use client";

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
import { Save } from "lucide-react";
import { useApiKey } from "@/hooks/useApiKey";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface VoiceCampaignData {
  name: string;
  description?: string;
  script: string;
  languageCode: string;
  voiceGender: "male" | "female";
  voiceSpeed: number;
  recordingEnabled: boolean;
  dtmfEnabled: boolean;
  maxRetries: number;
}

export function VoiceCampaignBuilder({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const apiKey = useApiKey();
  const [loading, setLoading] = useState(!!campaignId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VoiceCampaignData>({
    name: "",
    description: "",
    script: "",
    languageCode: "en-US",
    voiceGender: "male",
    voiceSpeed: 1.0,
    recordingEnabled: true,
    dtmfEnabled: false,
    maxRetries: 2,
  });

  useEffect(() => {
    if (!campaignId || !apiKey) return;

    const fetchCampaign = async () => {
      try {
        const response = await fetch(
          `${API_URL}/v1/voice-campaigns/${campaignId}`,
          {
            headers: { "x-api-key": apiKey },
          },
        );
        if (!response.ok) throw new Error("Failed to fetch campaign");
        const campaign = await response.json();
        setData({
          name: campaign.name,
          description: campaign.description || "",
          script: campaign.script,
          languageCode: campaign.languageCode || "en-US",
          voiceGender: campaign.voiceGender || "male",
          voiceSpeed: campaign.voiceSpeed || 1.0,
          recordingEnabled: campaign.recordingEnabled ?? true,
          dtmfEnabled: campaign.dtmfEnabled ?? false,
          maxRetries: campaign.maxRetries || 2,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId, apiKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim()) {
      setError("Campaign name is required");
      return;
    }
    if (!data.script.trim()) {
      setError("Script is required");
      return;
    }

    try {
      setSaving(true);
      const method = campaignId ? "PUT" : "POST";
      const url = campaignId
        ? `${API_URL}/v1/voice-campaigns/${campaignId}`
        : `${API_URL}/v1/voice-campaigns`;

      const response = await fetch(url, {
        method,
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(data),
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Campaign Name *</Label>
          <Input
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="e.g., Reactivation Campaign"
            className="mt-2"
          />
        </div>

        <div>
          <Label>Max Retries</Label>
          <Input
            type="number"
            min="0"
            max="5"
            value={data.maxRetries}
            onChange={(e) =>
              setData({ ...data, maxRetries: parseInt(e.target.value) })
            }
            className="mt-2"
          />
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          value={data.description || ""}
          onChange={(e) => setData({ ...data, description: e.target.value })}
          placeholder="Optional campaign description"
          className="mt-2 min-h-16"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Voice Script *</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={data.script}
            onChange={(e) => setData({ ...data, script: e.target.value })}
            placeholder="The script that will be read during calls (supports {{user.firstName}} template variables)"
            className="min-h-32 font-mono text-sm"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Voice Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="language">Language</Label>
              <Select
                value={data.languageCode}
                onValueChange={(value) =>
                  setData({ ...data, languageCode: value })
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="en-GB">English (UK)</SelectItem>
                  <SelectItem value="es-ES">Spanish (Spain)</SelectItem>
                  <SelectItem value="es-MX">Spanish (Mexico)</SelectItem>
                  <SelectItem value="fr-FR">French</SelectItem>
                  <SelectItem value="de-DE">German</SelectItem>
                  <SelectItem value="it-IT">Italian</SelectItem>
                  <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="gender">Voice Gender</Label>
              <Select
                value={data.voiceGender}
                onValueChange={(value) =>
                  setData({
                    ...data,
                    voiceGender: value as "male" | "female",
                  })
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Voice Speed</Label>
            <div className="flex items-center gap-4 mt-2">
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={data.voiceSpeed}
                onChange={(e) =>
                  setData({ ...data, voiceSpeed: parseFloat(e.target.value) })
                }
                className="flex-1"
              />
              <span className="text-sm font-medium w-12">
                {data.voiceSpeed.toFixed(1)}x
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Call Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="recording"
              checked={data.recordingEnabled}
              onChange={(e) =>
                setData({ ...data, recordingEnabled: e.target.checked })
              }
              className="rounded"
            />
            <Label htmlFor="recording" className="cursor-pointer">
              Enable call recording
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dtmf"
              checked={data.dtmfEnabled}
              onChange={(e) =>
                setData({ ...data, dtmfEnabled: e.target.checked })
              }
              className="rounded"
            />
            <Label htmlFor="dtmf" className="cursor-pointer">
              Enable DTMF input (IVR menu)
            </Label>
          </div>
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
