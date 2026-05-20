import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">Tenant, API keys y configuración de AI</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Slug</span>
            <code className="text-sm bg-muted px-2 py-0.5 rounded">prodecaballito</code>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm">Plan</span>
            <Badge>Enterprise</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm">Timezone</span>
            <code className="text-sm bg-muted px-2 py-0.5 rounded">America/Argentina/Buenos_Aires</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Provider</span>
            <Badge variant="outline">Anthropic Claude (default)</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm">Providers disponibles</span>
            <div className="flex gap-1">
              {['Anthropic', 'OpenAI', 'Gemini', 'Mistral', 'Ollama'].map((p) => (
                <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-1">Tone instructions</p>
            <p className="text-sm text-muted-foreground bg-muted rounded p-3">
              Tono futbolero argentino, apasionado, cercano, sin faltas de respeto. Usá lunfardo moderado.
              Celebrá los logros del usuario.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Gestioná API keys via{' '}
            <code className="bg-muted px-1 rounded">POST /admin/api-keys</code>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Las keys son hasheadas con SHA-256 — nunca se almacena el valor original.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
