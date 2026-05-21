import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { EmailCampaignList } from "./_components/EmailCampaignList";

export const dynamic = "force-dynamic";

export default function EmailCampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">Email Campaigns</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage email campaigns with delivery tracking and
            engagement metrics.
          </p>
        </div>
        <Link href="/email-campaigns/new">
          <Button className="gap-2">
            <Mail className="h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>
      <EmailCampaignList />
    </div>
  );
}
