import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { PushCampaignList } from "./_components/PushCampaignList";

export const dynamic = "force-dynamic";

export default function PushCampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">
            Push Notifications
          </h1>
          <p className="text-muted-foreground mt-2">
            Create and manage push notification campaigns
          </p>
        </div>
        <Link href="/push-campaigns/new">
          <Button className="gap-2">
            <Bell className="h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>
      <PushCampaignList />
    </div>
  );
}
