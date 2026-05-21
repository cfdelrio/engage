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

interface WhatsAppCampaignData {
  name: string;
  description?: string;
  message: string;
  mediaUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  triggerType: "manual" | "scheduled" | "rule-based" | "event-based";
}

export function WhatsAppCampaignBuilder({
  campaignId,
}: {
  campaignId?: string;
}) {
  const router = useRouter();
  const apiKey = useApiKey();
  const [loading, setLoading] = useState(!!campaignId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WhatsAppCampaignData>({
    name: "",
    description: "",
    message: "",
    mediaUrl: "",
    buttonText: "",
    buttonUrl: "",
    triggerType: "manual",
  });

  useEffect(() => {
    if (!campaignId || !apiKey) return;

    const fetchCampaign = async () => {
      try {
        const response = await fetch(
          `${API_URL}/v1/whatsapp-campaigns/${campaignId}`,
          {
            headers: { "x-api-key": apiKey },
          },
        );
        if (!response.ok) throw new Error("Failed to fetch campaign");
        const campaign = await response.json();
        setData({
          name: campaign.name,
          description: campaign.description || "",
          message: campaign.message,
          mediaUrl: campaign.mediaUrl || "",
          buttonText: campaign.buttonText || "",
          buttonUrl: campaign.buttonUrl || "",
          triggerType: campaign.triggerType || "manual",
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
    if (!data.message.trim()) {
      setError("Message is required");
      return;
    }
    if (data.message.length > 4096) {
      setError("Message must be 4096 characters or less");
      return;
    }

    try {
      setSaving(true);
      const method = campaignId ? "PUT" : "POST";
      const url = campaignId
        ? `${API_URL}/v1/whatsapp-campaigns/${campaignId}`
        : `${API_URL}/v1/whatsapp-campaigns`;

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

      router.push("/whatsapp-campaigns");
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
            placeholder="e.g., Promotional Campaign"
            className="mt-2"
          />
        </div>

        <div>
          <Label>Trigger Type</Label>
          <Select
            value={data.triggerType}
            onValueChange={(triggerType) =>
              setData({
                ...data,
                triggerType: triggerType as WhatsAppCampaignData["triggerType"],
              })
            }
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="rule-based">Rule-based</SelectItem>
              <SelectItem value="event-based">Event-based</SelectItem>
            </SelectContent>
          </Select>
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
          <CardTitle className="text-sm">Message *</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={data.message}
            onChange={(e) => setData({ ...data, message: e.target.value })}
            placeholder="Your WhatsApp message (max 4096 characters)"
            className="min-h-32 font-mono text-sm"
          />
          <div className="text-xs text-muted-foreground mt-2">
            {data.message.length} / 4096 characters
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Media URL (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={data.mediaUrl || ""}
            onChange={(e) => setData({ ...data, mediaUrl: e.target.value })}
            placeholder="https://example.com/image.jpg"
            type="url"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Image, video, or document URL to attach to the message
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Button (Optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="buttonText" className="text-sm">
              Button Text
            </Label>
            <Input
              id="buttonText"
              value={data.buttonText || ""}
              onChange={(e) => setData({ ...data, buttonText: e.target.value })}
              placeholder="e.g., Shop Now"
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="buttonUrl" className="text-sm">
              Button URL
            </Label>
            <Input
              id="buttonUrl"
              value={data.buttonUrl || ""}
              onChange={(e) => setData({ ...data, buttonUrl: e.target.value })}
              placeholder="https://example.com"
              type="url"
              className="mt-2"
            />
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
