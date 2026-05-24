import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { PushCampaignBuilder } from "../_components/PushCampaignBuilder";

export default function NewPushCampaignPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/push-campaigns">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">
            Create Push Campaign
          </h1>
          <p className="text-muted-foreground mt-1">
            Set up a new push notification campaign with custom message and
            delivery triggers.
          </p>
        </div>
      </div>
      <PushCampaignBuilder />
    </div>
  );
}
