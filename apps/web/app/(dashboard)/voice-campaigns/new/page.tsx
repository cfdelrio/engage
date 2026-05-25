import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { VoiceCampaignBuilder } from "../_components/VoiceCampaignBuilder";

export default function NewVoiceCampaignPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/voice-campaigns">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">
            Create Voice Campaign
          </h1>
          <p className="text-muted-foreground mt-1">
            Set up a new voice campaign with custom script and voice settings.
          </p>
        </div>
      </div>
      <VoiceCampaignBuilder />
    </div>
  );
}
