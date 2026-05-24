import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { EmailCampaignBuilder } from "../_components/EmailCampaignBuilder";

export default function NewEmailCampaignPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/email-campaigns">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">
            Create Email Campaign
          </h1>
          <p className="text-muted-foreground mt-1">
            Set up a new email campaign with custom content and delivery
            triggers.
          </p>
        </div>
      </div>
      <EmailCampaignBuilder />
    </div>
  );
}
