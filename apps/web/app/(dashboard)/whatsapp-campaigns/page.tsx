import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { WhatsAppCampaignList } from "./_components/WhatsAppCampaignList";

export const dynamic = "force-dynamic";

export default function WhatsAppCampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">
            WhatsApp Campaigns
          </h1>
          <p className="text-muted-foreground mt-2">
            Create and manage WhatsApp campaigns
          </p>
        </div>
        <Link href="/whatsapp-campaigns/new">
          <Button className="gap-2">
            <MessageCircle className="h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>
      <WhatsAppCampaignList />
    </div>
  );
}
