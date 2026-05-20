export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TemplatesList } from './_components/TemplatesList';

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Templates de Mensajes</h1>
          <p className="text-muted-foreground text-sm mt-1">Crea y gestiona plantillas reutilizables</p>
        </div>
        <Link href="/dashboard/templates/new">
          <Button>Nuevo Template</Button>
        </Link>
      </div>
      <TemplatesList />
    </div>
  );
}
