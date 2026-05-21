import { PushCampaignList } from "./_components/PushCampaignList";

export const dynamic = "force-dynamic";

export default function PushCampaignsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Push Notifications</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage push notification campaigns with real-time tracking
          and engagement metrics.
        </p>
      </div>
      <PushCampaignList />
    </div>
  );
}
