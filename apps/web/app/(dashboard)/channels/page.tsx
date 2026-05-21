export const dynamic = "force-dynamic";
import { ChannelProviders } from "./ChannelProviders";

export default function ChannelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Canales y proveedores</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configura tus API keys para cada canal
        </p>
      </div>

      <ChannelProviders />
    </div>
  );
}
