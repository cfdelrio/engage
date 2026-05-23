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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save } from "lucide-react";
import {
  whatsAppCampaignSchema,
  type WhatsAppCampaignValues,
} from "@/lib/campaign-schemas";

export function WhatsAppCampaignBuilder({
  campaignId,
}: {
  campaignId?: string;
}) {
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
  } = useForm<WhatsAppCampaignValues>({
    resolver: zodResolver(whatsAppCampaignSchema),
    defaultValues: {
      name: "",
      description: "",
      message: "",
      mediaUrl: "",
      buttonText: "",
      buttonUrl: "",
      triggerType: "manual",
    },
  });

  const messageValue = watch("message");

  useEffect(() => {
    if (!campaignId) return;

    const fetchCampaign = async () => {
      try {
        const response = await apiFetch(`/v1/whatsapp-campaigns/${campaignId}`);
        if (!response.ok) throw new Error("Failed to fetch campaign");
        const campaign = await response.json();
        reset({
          name: campaign.name,
          description: campaign.description ?? "",
          message: campaign.message,
          mediaUrl: campaign.mediaUrl ?? "",
          buttonText: campaign.buttonText ?? "",
          buttonUrl: campaign.buttonUrl ?? "",
          triggerType: campaign.triggerType ?? "manual",
        });
      } catch (err) {
        setApiError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId, reset]);

  const onSubmit = async (data: WhatsAppCampaignValues) => {
    setApiError(null);
    try {
      setSaving(true);
      const method = campaignId ? "PUT" : "POST";
      const url = campaignId
        ? `/v1/whatsapp-campaigns/${campaignId}`
        : `/v1/whatsapp-campaigns`;

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

      router.push("/whatsapp-campaigns");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4">Loading campaign...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
      {apiError && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{apiError}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Campaign Name *</Label>
          <Input
            {...register("name")}
            placeholder="e.g., Promotional Campaign"
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
                  <SelectItem value="rule-based">Rule-based</SelectItem>
                  <SelectItem value="event-based">Event-based</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          {...register("description")}
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
            {...register("message")}
            placeholder="Your WhatsApp message (max 4096 characters)"
            className="min-h-32 font-mono text-sm"
          />
          {errors.message && (
            <p className="text-sm text-red-600 mt-1">
              {errors.message.message}
            </p>
          )}
          <div className="text-xs text-muted-foreground mt-2">
            {messageValue?.length ?? 0} / 4096 characters
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Media URL (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            {...register("mediaUrl")}
            placeholder="https://example.com/image.jpg"
            type="url"
          />
          {errors.mediaUrl && (
            <p className="text-sm text-red-600 mt-1">
              {errors.mediaUrl.message}
            </p>
          )}
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
              {...register("buttonText")}
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
              {...register("buttonUrl")}
              placeholder="https://example.com"
              type="url"
              className="mt-2"
            />
            {errors.buttonUrl && (
              <p className="text-sm text-red-600 mt-1">
                {errors.buttonUrl.message}
              </p>
            )}
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
