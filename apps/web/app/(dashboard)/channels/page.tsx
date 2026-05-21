export const dynamic = "force-dynamic";
import { ChannelProviders } from "./ChannelProviders";

export default function ChannelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Channels</h1>
        <p className="text-muted-foreground mt-2">
          Configure providers for each delivery channel
        </p>
      </div>

      <ChannelProviders />
    </div>
  );
}
