"use client";

import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TemplatePreview } from "./TemplatePreview";
import { Save } from "lucide-react";

interface TemplateData {
  name: string;
  channel: "email" | "sms" | "push" | "whatsapp" | "voice";
  subject?: string;
  body: string;
  bodyHtml?: string;
}

const SAMPLE_VARIABLES: Record<string, Record<string, string>> = {
  email: {
    "user.firstName": "John",
    "user.email": "john@example.com",
    "user.lastName": "Doe",
    "campaign.name": "Black Friday Sale",
  },
  sms: {
    "user.firstName": "John",
    "campaign.name": "Black Friday",
  },
  push: {
    "user.firstName": "John",
    "event.type": "purchase",
    "event.amount": "99.99",
  },
  whatsapp: {
    "user.firstName": "John",
    "user.phone": "+1234567890",
    "campaign.name": "Offer",
  },
  voice: {
    "user.firstName": "John",
    "user.rank": "Top 10",
  },
};

export function TemplateEditor({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TemplateData>({
    name: "",
    channel: "email",
    subject: "",
    body: "",
    bodyHtml: "",
  });

  useEffect(() => {
    if (!templateId) return;

    const fetchTemplate = async () => {
      try {
        const response = await apiFetch(`/v1/templates/${templateId}`);
        if (!response.ok) throw new Error("Failed to fetch template");
        const template = await response.json();
        setData({
          name: template.name,
          channel: template.channel,
          subject: template.subject || "",
          body: template.body,
          bodyHtml: template.bodyHtml || "",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [templateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim()) {
      setError("Template name is required");
      return;
    }
    if (!data.body.trim()) {
      setError("Template body is required");
      return;
    }

    try {
      setSaving(true);
      const method = templateId ? "PUT" : "POST";
      const url = templateId ? `/v1/templates/${templateId}` : `/v1/templates`;

      const response = await apiFetch(url, {
        method,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to save template");
      }

      router.push("/templates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4">Loading template...</div>;

  const sampleVars = SAMPLE_VARIABLES[data.channel] || {};

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl">
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Template Name *</Label>
          <Input
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="e.g., Welcome Email"
            className="mt-2"
          />
        </div>

        <div>
          <Label>Channel *</Label>
          <Select
            value={data.channel}
            onValueChange={(channel) =>
              setData({ ...data, channel: channel as TemplateData["channel"] })
            }
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="push">Push Notification</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="voice">Voice</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col justify-end">
          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : templateId ? "Update" : "Create"} Template
          </Button>
        </div>
      </div>

      <Tabs defaultValue="editor" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          {data.channel === "email" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Subject Line *</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={data.subject || ""}
                  onChange={(e) =>
                    setData({ ...data, subject: e.target.value })
                  }
                  placeholder="e.g., Welcome {{user.firstName}}!"
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm">Body *</CardTitle>
                <div className="text-xs text-muted-foreground">
                  Available variables:
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(sampleVars).map(([key]) => (
                      <Badge key={key} variant="secondary" className="text-xs">
                        {"{{" + key + "}}"}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={data.body}
                onChange={(e) => setData({ ...data, body: e.target.value })}
                placeholder="Enter your template body here. Use {{variable}} for dynamic content."
                className="min-h-[200px] font-mono text-sm"
              />
            </CardContent>
          </Card>

          {data.channel === "email" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">HTML Body (Optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={data.bodyHtml || ""}
                  onChange={(e) =>
                    setData({ ...data, bodyHtml: e.target.value })
                  }
                  placeholder="Enter HTML version for email rendering"
                  className="min-h-[200px] font-mono text-sm"
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="preview">
          <TemplatePreview template={data} sampleVariables={sampleVars} />
        </TabsContent>
      </Tabs>
    </form>
  );
}
