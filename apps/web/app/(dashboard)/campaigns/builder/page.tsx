"use client";

import { useRouter } from "next/navigation";
import { CampaignBuilder } from "./CampaignBuilder";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export default function CampaignBuilderPage() {
  const router = useRouter();

  const handleSave = async (data: {
    name: string;
    trigger: Record<string, unknown>;
    rules: Record<string, unknown>;
    templateId?: string;
    channels: string[];
  }) => {
    const apiKey = localStorage.getItem("engage_api_key") ?? "";

    const response = await fetch(`${API_URL}/v1/campaigns`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
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
        <h1 className="text-2xl font-bold">Constructor de campaña</h1>
        <p className="text-muted-foreground mt-1">
          Sigue los pasos para crear una nueva campaña
        </p>
      </div>

      <CampaignBuilder onSave={handleSave} />
    </div>
  );
}
