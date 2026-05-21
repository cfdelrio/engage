import { WhatsAppCampaignList } from "./_components/WhatsAppCampaignList";

export const dynamic = "force-dynamic";

export default function WhatsAppCampaignsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">WhatsApp Campaigns</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage WhatsApp campaigns with real-time tracking and
          engagement metrics.
        </p>
      </div>
      <WhatsAppCampaignList />
    </div>
  );
}
