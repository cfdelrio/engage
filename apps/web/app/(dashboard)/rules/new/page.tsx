'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env['INTERNAL_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export default function NewRulePage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  async function handleCreate() {
    if (!name.trim()) return;

    setCreating(true);
    try {
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      const res = await fetch(`${API_URL}/v1/rules`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name,
          enabled: true,
          priority: 0,
          conditions: { operator: 'AND', conditions: [] },
          actions: [],
        }),
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

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-3xl font-bold">Nueva Regla</h1>
        <p className="text-muted-foreground text-sm mt-1">Creá una nueva regla de engagement</p>
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
          <Button onClick={handleCreate} disabled={!name.trim() || creating}>
            {creating ? 'Creando...' : 'Crear Regla'}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
