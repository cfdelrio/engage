import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RulesList } from './RulesList';

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Motor de Reglas</h1>
          <p className="text-muted-foreground text-sm mt-1">Configurá IF/THEN de engagement</p>
        </div>
        <Badge variant="outline">JSON DSL</Badge>
      </div>
      <RulesList />
    </div>
  );
}
