"use client";

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
import { useApiKey } from "@/hooks/useApiKey";
import {
  smsCampaignSchema,
  type SmsCampaignValues,
} from "@/lib/campaign-schemas";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export function SmsCampaignBuilder({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const apiKey = useApiKey();
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
  } = useForm<SmsCampaignValues>({
    resolver: zodResolver(smsCampaignSchema),
    defaultValues: {
      name: "",
      description: "",
      body: "",
      fromNumber: "",
      triggerType: "manual",
    },
  });

  const bodyValue = watch("body");
  const triggerType = watch("triggerType");

  useEffect(() => {
    if (!campaignId || !apiKey) return;

    const fetchCampaign = async () => {
      try {
        const response = await fetch(
          `${API_URL}/v1/sms-campaigns/${campaignId}`,
          { headers: { "x-api-key": apiKey } },
        );
        if (!response.ok) throw new Error("Failed to fetch campaign");
        const campaign = await response.json();
        reset({
          name: campaign.name,
          description: campaign.description ?? "",
          body: campaign.body,
          fromNumber: campaign.fromNumber ?? "",
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
  }, [campaignId, apiKey, reset]);

  const onSubmit = async (data: SmsCampaignValues) => {
    setApiError(null);
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Campaign Name *</Label>
          <Input
            {...register("name")}
            placeholder="e.g., Welcome SMS"
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
          className="mt-2 min-h-16"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Message Body *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            {...register("body")}
            placeholder="Enter your SMS message. Use {{user.firstName}}, {{user.email}}, etc. for variables"
            className="min-h-32 font-mono text-sm"
          />
          {errors.body && (
            <p className="text-sm text-red-600">{errors.body.message}</p>
          )}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{bodyValue?.length ?? 0} characters</span>
            <span
              className={
                (bodyValue?.length ?? 0) > 1600
                  ? "text-red-600 font-semibold"
                  : ""
              }
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
            {...register("fromNumber")}
            placeholder="e.g., +1234567890 (optional, uses default if not set)"
          />
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
    </form>
  );
}
