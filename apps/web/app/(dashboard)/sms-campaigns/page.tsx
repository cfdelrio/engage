import { SmsCampaignList } from "./_components/SmsCampaignList";

export const dynamic = "force-dynamic";

export default function SmsCampaignsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">SMS Campaigns</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage SMS marketing campaigns with real-time delivery
          tracking and engagement metrics.
        </p>
      </div>
      <SmsCampaignList />
    </div>
  );
}
