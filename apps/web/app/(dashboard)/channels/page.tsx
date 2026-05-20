export const dynamic = 'force-dynamic';
import { ChannelsList } from './_components/ChannelsList';

export default function ChannelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Canales de Entrega</h1>
        <p className="text-muted-foreground text-sm mt-1">Configura los proveedores para cada canal</p>
      </div>
      <ChannelsList />
    </div>
  );
}
