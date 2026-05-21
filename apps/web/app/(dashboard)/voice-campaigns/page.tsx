import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { VoiceCampaignList } from "./_components/VoiceCampaignList";

export const dynamic = "force-dynamic";

export default function VoiceCampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Voice Campaigns</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage voice campaigns with call recording and sentiment
            analysis
          </p>
        </div>
        <Link href="/voice-campaigns/new">
          <Button className="gap-2">
            <Phone className="h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>
      <VoiceCampaignList />
    </div>
  );
}
