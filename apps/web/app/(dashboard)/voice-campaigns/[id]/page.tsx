import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { VoiceCampaignBuilder } from "../_components/VoiceCampaignBuilder";
import { VoiceCampaignStats } from "../_components/VoiceCampaignStats";
import { VoiceCallLog } from "../_components/VoiceCallLog";
import { AudienceManager } from "../_components/AudienceManager";

export const dynamic = "force-dynamic";

interface VoiceCampaignDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function VoiceCampaignDetailPage({
  params,
}: VoiceCampaignDetailPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/voice-campaigns">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-[26px] font-bold tracking-tight">Voice Campaign</h1>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="calls">Calls</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <VoiceCampaignBuilder campaignId={id} />
        </TabsContent>

        <TabsContent value="audience" className="space-y-4">
          <AudienceManager campaignId={id} />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <VoiceCampaignStats campaignId={id} />
        </TabsContent>

        <TabsContent value="calls" className="space-y-4">
          <VoiceCallLog campaignId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
