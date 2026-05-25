import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { SmsCampaignBuilder } from "../_components/SmsCampaignBuilder";

export default function NewSmsCampaignPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sms-campaigns">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">
            Create SMS Campaign
          </h1>
          <p className="text-muted-foreground mt-1">
            Set up a new SMS campaign with custom message and delivery triggers.
          </p>
        </div>
      </div>
      <SmsCampaignBuilder />
    </div>
  );
}
