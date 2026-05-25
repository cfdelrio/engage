import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { PushCampaignBuilder } from "../_components/PushCampaignBuilder";
import { PushCampaignStats } from "../_components/PushCampaignStats";

export const dynamic = "force-dynamic";

interface PushCampaignDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PushCampaignDetailPage({
  params,
}: PushCampaignDetailPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/push-campaigns">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-[26px] font-bold tracking-tight">Push Campaign</h1>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <PushCampaignBuilder campaignId={id} />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <PushCampaignStats campaignId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
