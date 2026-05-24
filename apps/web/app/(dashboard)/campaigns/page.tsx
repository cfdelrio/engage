export const dynamic = "force-dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CampaignsList } from "./CampaignsList";

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage engagement campaigns
          </p>
        </div>
        <Link href="/campaigns/builder">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      <CampaignsList />
    </div>
  );
}
