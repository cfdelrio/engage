'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API_URL = process.env['INTERNAL_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

const CHANNELS = ['email', 'sms', 'push', 'whatsapp', 'voice'];

export default function NewTemplatePage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('');

  async function handleCreate() {
    if (!name.trim() || !channel) return;

    setCreating(true);
    try {
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      const res = await fetch(`${API_URL}/v1/templates`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name,
          channel,
          body: 'Hola {{user.firstName}}, bienvenido',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/templates/${data.id}`);
      }
    } catch (err) {
      console.error('Failed to create template:', err);
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-3xl font-bold">Nuevo Template</h1>
        <p className="text-muted-foreground text-sm mt-1">Crea una nueva plantilla de mensajes</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Nombre</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del template"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Canal</label>
          <Select value={channel} onValueChange={(value) => value && setChannel(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona canal" />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-4">
          <Button onClick={handleCreate} disabled={!name.trim() || !channel || creating}>
            {creating ? 'Creando...' : 'Crear Template'}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
