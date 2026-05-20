export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-muted-foreground text-sm mt-1">Perfiles de engagement y fatiga</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Segmentación por engagement score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Alta engagement', range: '0.7 – 1.0', color: 'bg-green-500', count: '—' },
              { label: 'Media engagement', range: '0.4 – 0.7', color: 'bg-yellow-500', count: '—' },
              { label: 'Fatiga alta', range: 'Fatiga > 0.8', color: 'bg-red-500', count: '—' },
            ].map(({ label, range, color, count }) => (
              <div key={label} className="rounded-lg border p-4">
                <div className={`h-2 w-2 rounded-full ${color} mb-2`} />
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{range}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p className="text-sm">Integrá la API para ver perfiles de engagement en tiempo real</p>
          <code className="text-xs bg-muted px-2 py-1 rounded mt-2 inline-block">
            GET /v1/users/:id/engagement
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
