import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { EmailCampaignBuilder } from "../_components/EmailCampaignBuilder";
import { EmailCampaignStats } from "../_components/EmailCampaignStats";

export const dynamic = "force-dynamic";

interface EmailCampaignDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EmailCampaignDetailPage({
  params,
}: EmailCampaignDetailPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/email-campaigns">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-[26px] font-bold tracking-tight">Email Campaign</h1>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <EmailCampaignBuilder campaignId={id} />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <EmailCampaignStats campaignId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
