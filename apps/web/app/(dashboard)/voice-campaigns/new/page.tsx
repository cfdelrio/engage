import { VoiceCampaignBuilder } from "../_components/VoiceCampaignBuilder";

export default function NewVoiceCampaignPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Create Voice Campaign</h1>
        <VoiceCampaignBuilder />
      </div>
    </div>
  );
}
