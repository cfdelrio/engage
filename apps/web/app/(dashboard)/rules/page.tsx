export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RulesList } from './RulesList';

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Motor de Reglas</h1>
          <p className="text-muted-foreground text-sm mt-1">Configurá IF/THEN de engagement</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">JSON DSL</Badge>
          <Link href="/dashboard/rules/new">
            <Button>Nueva Regla</Button>
          </Link>
        </div>
      </div>
      <RulesList />
    </div>
  );
}
