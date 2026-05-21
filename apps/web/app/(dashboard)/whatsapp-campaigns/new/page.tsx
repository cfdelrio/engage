import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { WhatsAppCampaignBuilder } from "../_components/WhatsAppCampaignBuilder";

export default function NewWhatsAppCampaignPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/whatsapp-campaigns">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-4xl font-bold">Create WhatsApp Campaign</h1>
          <p className="text-muted-foreground mt-1">
            Set up a new WhatsApp campaign with custom message and delivery
            triggers.
          </p>
        </div>
      </div>
      <WhatsAppCampaignBuilder />
    </div>
  );
}
