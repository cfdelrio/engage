import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe } from 'lucide-react';

export default function FeedsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Public Feeds</h1>
        <p className="text-muted-foreground text-sm mt-1">Feeds embebibles en tiempo real</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <Globe className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">⚽ La voz de la hinchada</CardTitle>
            <p className="text-xs text-muted-foreground">la-voz-de-la-hinchada</p>
          </div>
          <Badge className="ml-auto">Activo</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Embed code</p>
            <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto">
{`<!-- ORKESTAI ENGAGE — Public Feed Widget -->
<div id="engage-feed"></div>
<script src="https://cdn.orkestai.com/widget.js"
  data-feed="la-voz-de-la-hinchada"
  data-token="<embed-token>">
</script>`}
            </pre>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Entradas hoy', value: '—' },
              { label: 'Reacciones', value: '—' },
              { label: 'Polls activos', value: '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted rounded-lg p-3">
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
