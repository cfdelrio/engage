"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceCallLog } from "../_components/VoiceCallLog";
import { VoiceCampaignStats } from "../_components/VoiceCampaignStats";

export default function VoiceCampaignDetailsPage() {
  const params = useParams();
  const campaignId = params.id as string;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Campaign Details</h1>
        <p className="text-muted-foreground">
          Monitor and analyze your voice campaign
        </p>
      </div>

      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="calls">Call Log</TabsTrigger>
        </TabsList>

        <TabsContent value="stats">
          <VoiceCampaignStats campaignId={campaignId} />
        </TabsContent>

        <TabsContent value="calls">
          <Card>
            <CardHeader>
              <CardTitle>All Calls</CardTitle>
            </CardHeader>
            <CardContent>
              <VoiceCallLog campaignId={campaignId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
