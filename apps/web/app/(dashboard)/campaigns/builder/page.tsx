"use client";

import { apiFetch } from "@/lib/api-client";

import { useRouter } from "next/navigation";
import { CampaignBuilder } from "./CampaignBuilder";

export default function CampaignBuilderPage() {
  const router = useRouter();

  const handleSave = async (data: {
    name: string;
    trigger: {
      type: string;
      date?: string;
      time?: string;
      eventType?: string;
      frequency?: string;
    };
    rules: { operator: "AND" | "OR"; conditions: unknown[] };
    templateId?: string;
    channels: string[];
  }) => {
    const response = await apiFetch(`/v1/campaigns`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: data.name,
        type: data.trigger.type,
        channels: data.channels,
        trigger: data.trigger,
        rules: data.rules,
        templateId: data.templateId,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create campaign");
    }

    const campaign = await response.json();
    router.push(`/campaigns/${campaign.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Campaign Builder</h1>
        <p className="text-muted-foreground mt-2">
          Follow the steps to create a new campaign
        </p>
      </div>

      <CampaignBuilder onSave={handleSave} />
    </div>
  );
}
