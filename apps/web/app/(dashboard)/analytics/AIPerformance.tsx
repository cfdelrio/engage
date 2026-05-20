import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain } from 'lucide-react';

const API_URL = process.env['INTERNAL_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const API_KEY = process.env['INTERNAL_API_KEY'] ?? '';

interface AIStats {
  total: number;
  aiGenerated: number;
  aiAdoptionRate: number;
}

async function getAIStats(): Promise<AIStats | null> {
  try {
    const res = await fetch(`${API_URL}/v1/analytics/ai-performance`, {
      headers: { 'x-api-key': API_KEY },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function AIPerformance() {
  const stats = await getAIStats();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">AI Performance</CardTitle>
        <Brain className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {!stats ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-5xl font-bold text-primary">
                {Math.round(stats.aiAdoptionRate * 100)}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">Decisiones asistidas por AI</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total decisiones</p>
              </div>
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {stats.aiGenerated.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Decisiones AI</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-xs">Provider-agnostic</Badge>
              <Badge variant="outline" className="text-xs">Auditable</Badge>
              <Badge variant="outline" className="text-xs">Guardrails</Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
