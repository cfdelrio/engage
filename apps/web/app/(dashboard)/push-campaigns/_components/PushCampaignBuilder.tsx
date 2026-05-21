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

interface PushCampaignData {
  name: string;
  description?: string;
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
  priority: "high" | "normal";
}

export function PushCampaignBuilder({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const apiKey = useApiKey();
  const [loading, setLoading] = useState(!!campaignId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PushCampaignData>({
    name: "",
    description: "",
    title: "",
    body: "",
    imageUrl: "",
    actionUrl: "",
    priority: "high",
  });

  useEffect(() => {
    if (!campaignId || !apiKey) return;

    const fetchCampaign = async () => {
      try {
        const response = await fetch(
          `${API_URL}/v1/push-campaigns/${campaignId}`,
          {
            headers: { "x-api-key": apiKey },
          },
        );
        if (!response.ok) throw new Error("Failed to fetch campaign");
        const campaign = await response.json();
        setData({
          name: campaign.name,
          description: campaign.description || "",
          title: campaign.title,
          body: campaign.body,
          imageUrl: campaign.imageUrl || "",
          actionUrl: campaign.actionUrl || "",
          priority: campaign.priority || "high",
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
    if (!data.title.trim()) {
      setError("Notification title is required");
      return;
    }
    if (!data.body.trim()) {
      setError("Notification body is required");
      return;
    }

    try {
      setSaving(true);
      const method = campaignId ? "PUT" : "POST";
      const url = campaignId
        ? `${API_URL}/v1/push-campaigns/${campaignId}`
        : `${API_URL}/v1/push-campaigns`;

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

      router.push("/push-campaigns");
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
            placeholder="e.g., App Update Notification"
            className="mt-2"
          />
        </div>

        <div>
          <Label>Priority</Label>
          <Select
            value={data.priority}
            onValueChange={(priority) =>
              setData({ ...data, priority: priority as "high" | "normal" })
            }
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
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
          <CardTitle className="text-sm">Notification Title *</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={data.title}
            onChange={(e) => setData({ ...data, title: e.target.value })}
            placeholder="e.g., New Feature Available"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Notification Body *</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={data.body}
            onChange={(e) => setData({ ...data, body: e.target.value })}
            placeholder="Main notification message"
            className="min-h-32 font-mono text-sm"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Image URL (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={data.imageUrl || ""}
            onChange={(e) => setData({ ...data, imageUrl: e.target.value })}
            placeholder="https://example.com/image.png"
            type="url"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Action URL (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={data.actionUrl || ""}
            onChange={(e) => setData({ ...data, actionUrl: e.target.value })}
            placeholder="https://example.com/action"
            type="url"
          />
        </CardContent>
      </Card>
    </form>
  );
}
