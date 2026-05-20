import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle } from 'lucide-react';

const channels = [
  { name: 'Email', provider: 'Resend', emoji: '📧', envKey: 'RESEND_API_KEY' },
  { name: 'SMS', provider: 'Twilio', emoji: '💬', envKey: 'TWILIO_ACCOUNT_SID' },
  { name: 'Push', provider: 'Firebase FCM', emoji: '🔔', envKey: 'FIREBASE_PROJECT_ID' },
  { name: 'WhatsApp', provider: 'Twilio', emoji: '💚', envKey: 'TWILIO_ACCOUNT_SID' },
  { name: 'Voice AI', provider: 'Twilio Voice', emoji: '📞', envKey: 'TWILIO_ACCOUNT_SID' },
  { name: 'In-App', provider: 'WebSocket', emoji: '📱', envKey: 'built-in' },
];

export default function ChannelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Canales</h1>
        <p className="text-muted-foreground text-sm mt-1">Configuración de providers por canal</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channels.map((channel) => (
          <Card key={channel.name}>
            <CardHeader className="flex flex-row items-center gap-3 pb-3">
              <span className="text-2xl">{channel.emoji}</span>
              <div className="flex-1">
                <CardTitle className="text-base">{channel.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{channel.provider}</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {channel.envKey === 'built-in' ? 'built-in' : 'via env'}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {channel.envKey === 'built-in' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
                {channel.envKey === 'built-in'
                  ? 'Activo sin configuración adicional'
                  : `Requiere ${channel.envKey} en .env`}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agregar provider custom</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Implementá la interfaz <code className="bg-muted px-1 rounded">ChannelProvider</code> en{' '}
            <code className="bg-muted px-1 rounded">packages/channels/src/providers/</code> para agregar
            cualquier provider sin modificar el core del sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
