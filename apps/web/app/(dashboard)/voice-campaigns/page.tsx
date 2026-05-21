import { VoiceCampaignList } from "./_components/VoiceCampaignList";

export const dynamic = "force-dynamic";

export default function VoiceCampaignsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Voice Campaigns</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage voice campaigns with real-time tracking, call
          recording, and sentiment analysis.
        </p>
      </div>
      <VoiceCampaignList />
    </div>
  );
}
