'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RuleTemplates } from '../_components/RuleTemplates';

interface RuleTemplate {
  name: string;
  description: string;
  conditions: unknown;
  actions: unknown;
}

const API_URL = process.env['INTERNAL_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export default function NewRulePage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  async function handleCreate(template?: RuleTemplate) {
    if (!name.trim()) return;

    setCreating(true);
    try {
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      const payload = {
        name,
        enabled: true,
        priority: 0,
        conditions: template?.conditions ?? { operator: 'AND', conditions: [] },
        actions: template?.actions ?? [],
      };
      const res = await fetch(`${API_URL}/v1/rules`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/rules/${data.id}`);
      }
    } catch (err) {
      console.error('Failed to create rule:', err);
      setCreating(false);
    }
  }

  const handleSelectTemplate = (template: RuleTemplate) => {
    setName(template.name);
    setTimeout(() => {
      handleCreate(template);
    }, 100);
  }

  return (
    <div className="space-y-6 grid grid-cols-2 gap-6">
      <div className="col-span-2">
        <h1 className="text-3xl font-bold">Nueva Regla</h1>
        <p className="text-muted-foreground text-sm mt-1">Creá una nueva regla de engagement o usa una plantilla predefinida</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Nombre</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la regla"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>

        <div className="flex gap-4">
          <Button onClick={() => handleCreate()} disabled={!name.trim() || creating}>
            {creating ? 'Creando...' : 'Crear Regla Vacía'}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </div>

      <RuleTemplates onSelectTemplate={handleSelectTemplate} />
    </div>
  );
}
