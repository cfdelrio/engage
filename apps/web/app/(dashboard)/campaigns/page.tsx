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
          <h1 className="text-2xl font-semibold">Campañas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Crea y gestiona campañas de engagement
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva campaña
          </Button>
        </Link>
      </div>

      <CampaignsList />
    </div>
  );
}
