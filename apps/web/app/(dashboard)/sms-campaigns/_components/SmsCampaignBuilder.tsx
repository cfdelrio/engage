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

interface SmsCampaignData {
  name: string;
  description?: string;
  body: string;
  fromNumber?: string;
  triggerType: "manual" | "scheduled" | "rule-based" | "event-based";
  scheduledFor?: string;
}

export function SmsCampaignBuilder({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const apiKey = useApiKey();
  const [loading, setLoading] = useState(!!campaignId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [data, setData] = useState<SmsCampaignData>({
    name: "",
    description: "",
    body: "",
    fromNumber: "",
    triggerType: "manual",
  });

  useEffect(() => {
    if (!campaignId || !apiKey) return;

    const fetchCampaign = async () => {
      try {
        const response = await fetch(
          `${API_URL}/v1/sms-campaigns/${campaignId}`,
          {
            headers: { "x-api-key": apiKey },
          },
        );
        if (!response.ok) throw new Error("Failed to fetch campaign");
        const campaign = await response.json();
        setData({
          name: campaign.name,
          description: campaign.description || "",
          body: campaign.body,
          fromNumber: campaign.fromNumber || "",
          triggerType: campaign.triggerType,
          scheduledFor: campaign.scheduledFor,
        });
        setCharCount(campaign.body.length);
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
    if (!data.body.trim()) {
      setError("Message body is required");
      return;
    }
    if (data.body.length > 1600) {
      setError("Message cannot exceed 1600 characters");
      return;
    }

    try {
      setSaving(true);
      const method = campaignId ? "PUT" : "POST";
      const url = campaignId
        ? `${API_URL}/v1/sms-campaigns/${campaignId}`
        : `${API_URL}/v1/sms-campaigns`;

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

      router.push("/sms-campaigns");
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Campaign Name *</Label>
          <Input
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="e.g., Welcome SMS"
            className="mt-2"
          />
        </div>

        <div>
          <Label>Trigger Type</Label>
          <Select
            value={data.triggerType}
            onValueChange={(type) =>
              setData({
                ...data,
                triggerType: type as SmsCampaignData["triggerType"],
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

        <div className="flex flex-col justify-end">
          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : campaignId ? "Update" : "Create"} Campaign
          </Button>
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
          <CardTitle className="text-sm">Message Body *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={data.body}
            onChange={(e) => {
              setData({ ...data, body: e.target.value });
              setCharCount(e.target.value.length);
            }}
            placeholder="Enter your SMS message. Use {{user.firstName}}, {{user.email}}, etc. for variables"
            className="min-h-32 font-mono text-sm"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{charCount} characters</span>
            <span
              className={charCount > 1600 ? "text-red-600 font-semibold" : ""}
            >
              Max: 1600
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sender Number</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={data.fromNumber || ""}
            onChange={(e) => setData({ ...data, fromNumber: e.target.value })}
            placeholder="e.g., +1234567890 (optional, uses default if not set)"
          />
        </CardContent>
      </Card>

      {data.triggerType === "scheduled" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Schedule For</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="datetime-local"
              value={data.scheduledFor || ""}
              onChange={(e) =>
                setData({ ...data, scheduledFor: e.target.value })
              }
            />
          </CardContent>
        </Card>
      )}
    </form>
  );
}
