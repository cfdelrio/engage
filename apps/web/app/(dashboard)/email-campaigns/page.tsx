import { EmailCampaignList } from "./_components/EmailCampaignList";

export const dynamic = "force-dynamic";

export default function EmailCampaignsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Email Campaigns</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage email marketing campaigns with real-time delivery
          tracking and engagement metrics.
        </p>
      </div>
      <EmailCampaignList />
    </div>
  );
}
