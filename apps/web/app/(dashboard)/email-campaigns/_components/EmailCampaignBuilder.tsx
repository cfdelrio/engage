"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface EmailCampaignData {
  name: string;
  description?: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  triggerType: "manual" | "scheduled" | "rule-based" | "event-based";
  scheduledFor?: string;
}

export function EmailCampaignBuilder({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const apiKey = useApiKey();
  const [loading, setLoading] = useState(!!campaignId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EmailCampaignData>({
    name: "",
    description: "",
    subject: "",
    bodyHtml: "",
    bodyText: "",
    fromName: "",
    fromEmail: "",
    replyTo: "",
    triggerType: "manual",
  });

  useEffect(() => {
    if (!campaignId || !apiKey) return;

    const fetchCampaign = async () => {
      try {
        const response = await fetch(
          `${API_URL}/v1/email-campaigns/${campaignId}`,
          {
            headers: { "x-api-key": apiKey },
          },
        );
        if (!response.ok) throw new Error("Failed to fetch campaign");
        const campaign = await response.json();
        setData({
          name: campaign.name,
          description: campaign.description || "",
          subject: campaign.subject,
          bodyHtml: campaign.bodyHtml,
          bodyText: campaign.bodyText || "",
          fromName: campaign.fromName || "",
          fromEmail: campaign.fromEmail || "",
          replyTo: campaign.replyTo || "",
          triggerType: campaign.triggerType,
          scheduledFor: campaign.scheduledFor,
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
    if (!data.subject.trim()) {
      setError("Subject is required");
      return;
    }
    if (!data.bodyHtml.trim()) {
      setError("Email body is required");
      return;
    }

    try {
      setSaving(true);
      const method = campaignId ? "PUT" : "POST";
      const url = campaignId
        ? `${API_URL}/v1/email-campaigns/${campaignId}`
        : `${API_URL}/v1/email-campaigns`;

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

      router.push("/email-campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4">Loading campaign...</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Campaign Name *</Label>
          <Input
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="e.g., Black Friday Campaign"
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
                triggerType: type as EmailCampaignData["triggerType"],
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
          className="mt-2 min-h-20"
        />
      </div>

      <Tabs defaultValue="content" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="sender">Sender & Reply</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Subject Line *</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={data.subject}
                onChange={(e) => setData({ ...data, subject: e.target.value })}
                placeholder="e.g., 50% off everything - Limited time!"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">HTML Body *</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={data.bodyHtml}
                onChange={(e) => setData({ ...data, bodyHtml: e.target.value })}
                placeholder="Enter HTML content for email"
                className="min-h-[300px] font-mono text-sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Text Body (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={data.bodyText || ""}
                onChange={(e) => setData({ ...data, bodyText: e.target.value })}
                placeholder="Plain text version of email (fallback)"
                className="min-h-[200px] font-mono text-sm"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sender" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">From Name</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={data.fromName || ""}
                onChange={(e) => setData({ ...data, fromName: e.target.value })}
                placeholder="e.g., ORKESTAI Team"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">From Email</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="email"
                value={data.fromEmail || ""}
                onChange={(e) =>
                  setData({ ...data, fromEmail: e.target.value })
                }
                placeholder="e.g., noreply@orkestai.com"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Reply-To Email</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="email"
                value={data.replyTo || ""}
                onChange={(e) => setData({ ...data, replyTo: e.target.value })}
                placeholder="e.g., support@orkestai.com"
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
        </TabsContent>
      </Tabs>
    </form>
  );
}
