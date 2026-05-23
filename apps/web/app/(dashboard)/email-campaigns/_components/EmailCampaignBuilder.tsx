"use client";

import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  emailCampaignSchema,
  type EmailCampaignValues,
} from "@/lib/campaign-schemas";

export function EmailCampaignBuilder({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(!!campaignId);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<EmailCampaignValues>({
    resolver: zodResolver(emailCampaignSchema),
    defaultValues: {
      name: "",
      description: "",
      subject: "",
      bodyHtml: "",
      bodyText: "",
      fromName: "",
      fromEmail: "",
      replyTo: "",
      triggerType: "manual",
    },
  });

  const triggerType = watch("triggerType");

  useEffect(() => {
    if (!campaignId) return;

    const fetchCampaign = async () => {
      try {
        const response = await apiFetch(`/v1/email-campaigns/${campaignId}`);
        if (!response.ok) throw new Error("Failed to fetch campaign");
        const campaign = await response.json();
        reset({
          name: campaign.name,
          description: campaign.description ?? "",
          subject: campaign.subject,
          bodyHtml: campaign.bodyHtml,
          bodyText: campaign.bodyText ?? "",
          fromName: campaign.fromName ?? "",
          fromEmail: campaign.fromEmail ?? "",
          replyTo: campaign.replyTo ?? "",
          triggerType: campaign.triggerType,
          scheduledFor: campaign.scheduledFor,
        });
      } catch (err) {
        setApiError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId, reset]);

  const onSubmit = async (data: EmailCampaignValues) => {
    setApiError(null);
    try {
      setSaving(true);
      const method = campaignId ? "PUT" : "POST";
      const url = campaignId
        ? `/v1/email-campaigns/${campaignId}`
        : `/v1/email-campaigns`;

      const response = await apiFetch(url, {
        method,
        headers: {
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
      setApiError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div className="h-10 bg-muted rounded animate-pulse" />
        <div className="h-24 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">
      {apiError && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{apiError}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Campaign Name *</Label>
          <Input
            {...register("name")}
            placeholder="e.g., Black Friday Campaign"
            className="mt-2"
          />
          {errors.name && (
            <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label>Trigger Type</Label>
          <Controller
            name="triggerType"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
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
            )}
          />
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
          {...register("description")}
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
                {...register("subject")}
                placeholder="e.g., 50% off everything - Limited time!"
              />
              {errors.subject && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.subject.message}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">HTML Body *</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                {...register("bodyHtml")}
                placeholder="Enter HTML content for email"
                className="min-h-[300px] font-mono text-sm"
              />
              {errors.bodyHtml && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.bodyHtml.message}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Text Body (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                {...register("bodyText")}
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
                {...register("fromName")}
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
                {...register("fromEmail")}
                placeholder="e.g., noreply@orkestai.com"
              />
              {errors.fromEmail && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.fromEmail.message}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Reply-To Email</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="email"
                {...register("replyTo")}
                placeholder="e.g., support@orkestai.com"
              />
              {errors.replyTo && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.replyTo.message}
                </p>
              )}
            </CardContent>
          </Card>

          {triggerType === "scheduled" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Schedule For</CardTitle>
              </CardHeader>
              <CardContent>
                <Input type="datetime-local" {...register("scheduledFor")} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </form>
  );
}
