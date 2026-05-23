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
  pushCampaignSchema,
  type PushCampaignValues,
} from "@/lib/campaign-schemas";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export function PushCampaignBuilder({ campaignId }: { campaignId?: string }) {
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
    formState: { errors },
  } = useForm<PushCampaignValues>({
    resolver: zodResolver(pushCampaignSchema),
    defaultValues: {
      name: "",
      description: "",
      title: "",
      body: "",
      imageUrl: "",
      actionUrl: "",
      priority: "high",
    },
  });

  useEffect(() => {
    if (!campaignId || !apiKey) return;

    const fetchCampaign = async () => {
      try {
        const response = await fetch(
          `${API_URL}/v1/push-campaigns/${campaignId}`,
          { headers: { "x-api-key": apiKey } },
        );
        if (!response.ok) throw new Error("Failed to fetch campaign");
        const campaign = await response.json();
        reset({
          name: campaign.name,
          description: campaign.description ?? "",
          title: campaign.title,
          body: campaign.body,
          imageUrl: campaign.imageUrl ?? "",
          actionUrl: campaign.actionUrl ?? "",
          priority: campaign.priority ?? "high",
        });
      } catch (err) {
        setApiError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId, apiKey, reset]);

  const onSubmit = async (data: PushCampaignValues) => {
    setApiError(null);
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
            placeholder="e.g., App Update Notification"
            className="mt-2"
          />
          {errors.name && (
            <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label>Priority</Label>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
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
          <CardTitle className="text-sm">Notification Title *</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            {...register("title")}
            placeholder="e.g., New Feature Available"
          />
          {errors.title && (
            <p className="text-sm text-red-600 mt-1">{errors.title.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Notification Body *</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            {...register("body")}
            placeholder="Main notification message"
            className="min-h-32 font-mono text-sm"
          />
          {errors.body && (
            <p className="text-sm text-red-600 mt-1">{errors.body.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Image URL (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            {...register("imageUrl")}
            placeholder="https://example.com/image.png"
            type="url"
          />
          {errors.imageUrl && (
            <p className="text-sm text-red-600 mt-1">
              {errors.imageUrl.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Action URL (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            {...register("actionUrl")}
            placeholder="https://example.com/action"
            type="url"
          />
          {errors.actionUrl && (
            <p className="text-sm text-red-600 mt-1">
              {errors.actionUrl.message}
            </p>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
