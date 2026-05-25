"use client";

import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, useFieldArray } from "react-hook-form";
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
import { Plus, Save, Trash2 } from "lucide-react";
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
      body: "",
      headerType: "none",
      headerValue: "",
      footerText: "",
      buttons: [],
      triggerType: "manual",
      eventType: "",
    },
  });

  const {
    fields: buttonFields,
    append: appendButton,
    remove: removeButton,
  } = useFieldArray({
    control,
    name: "buttons",
  });

  const bodyValue = watch("body");
  const watchTriggerType = watch("triggerType");
  const watchHeaderType = watch("headerType");

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
          body: campaign.body ?? "",
          headerType: campaign.headerType ?? "none",
          headerValue: campaign.headerValue ?? "",
          footerText: campaign.footerText ?? "",
          buttons: Array.isArray(campaign.buttons) ? campaign.buttons : [],
          triggerType: campaign.triggerType ?? "manual",
          eventType: campaign.eventType ?? "",
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
        headers: { "content-type": "application/json" },
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

      {/* Name + Trigger */}
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

        {watchTriggerType === "event-based" && (
          <div>
            <Label>Event Type *</Label>
            <Input
              {...register("eventType")}
              placeholder="e.g., user.signup, prode.resultado_publicado"
              className="mt-2"
            />
            {errors.eventType && (
              <p className="text-sm text-red-600 mt-1">
                {errors.eventType.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <Label>Description</Label>
        <Textarea
          {...register("description")}
          placeholder="Optional campaign description"
          className="mt-2 min-h-16"
        />
      </div>

      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Header (opcional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Header Type</Label>
            <Controller
              name="headerType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="image">Image URL</SelectItem>
                    <SelectItem value="document">Document URL</SelectItem>
                    <SelectItem value="video">Video URL</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {watchHeaderType !== "none" && (
            <div>
              <Label>
                {watchHeaderType === "text" ? "Header Text" : "Media URL"}
              </Label>
              <Input
                {...register("headerValue")}
                placeholder={
                  watchHeaderType === "text"
                    ? "Header text (max 60 chars)"
                    : "https://..."
                }
                className="mt-2"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Body */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Message *</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            {...register("body")}
            placeholder="Your WhatsApp message (max 4096 characters)"
            className="min-h-32 font-mono text-sm"
          />
          {errors.body && (
            <p className="text-sm text-red-600 mt-1">{errors.body.message}</p>
          )}
          <div className="text-xs text-muted-foreground mt-2">
            {bodyValue?.length ?? 0} / 4096 characters
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div>
        <Label>Footer (opcional)</Label>
        <Input
          {...register("footerText")}
          placeholder="e.g., Reply STOP to unsubscribe"
          className="mt-2"
          maxLength={60}
        />
        {errors.footerText && (
          <p className="text-sm text-red-600 mt-1">
            {errors.footerText.message}
          </p>
        )}
      </div>

      {/* Buttons */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Buttons (máx 3)</CardTitle>
          {buttonFields.length < 3 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendButton({ type: "reply", text: "", value: "" })
              }
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Button
            </Button>
          )}
        </CardHeader>
        {buttonFields.length > 0 && (
          <CardContent className="space-y-3">
            {buttonFields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-start">
                <Controller
                  name={`buttons.${index}.type`}
                  control={control}
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger className="w-28 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reply">Reply</SelectItem>
                        <SelectItem value="url">URL</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <Input
                  {...register(`buttons.${index}.text`)}
                  placeholder="Button text"
                  maxLength={20}
                />
                <Input
                  {...register(`buttons.${index}.value`)}
                  placeholder={
                    watch(`buttons.${index}.type`) === "url"
                      ? "https://..."
                      : "payload"
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeButton(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        )}
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
