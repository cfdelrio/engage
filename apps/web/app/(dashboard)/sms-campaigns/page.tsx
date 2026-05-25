import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { SmsCampaignList } from "./_components/SmsCampaignList";

export const dynamic = "force-dynamic";

export default function SmsCampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">
            SMS Campaigns
          </h1>
          <p className="text-muted-foreground mt-2">
            Create and manage SMS campaigns with delivery tracking and
            engagement metrics.
          </p>
        </div>
        <Link href="/sms-campaigns/new">
          <Button className="gap-2">
            <MessageSquare className="h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>
      <SmsCampaignList />
    </div>
  );
}
