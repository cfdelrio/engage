'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RuleBuilder } from '../_components/RuleBuilder';
import { ActionBuilder } from '../_components/ActionBuilder';

interface Rule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditions: unknown;
  actions: unknown;
  cooldownSeconds?: number;
}

const API_URL = process.env['INTERNAL_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export default function RuleDetailPage({ params }: { params: { id: string } }) {
  const [rule, setRule] = useState<Rule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [cooldownHours, setCooldownHours] = useState(0);
  const [conditions, setConditions] = useState<unknown>(null);
  const [actions, setActions] = useState<unknown>(null);

  useEffect(() => {
    const doFetch = async () => {
      try {
        const apiKey = localStorage.getItem('engage_api_key') ?? '';
        const res = await fetch(`${API_URL}/v1/rules/${params.id}`, {
          headers: { 'x-api-key': apiKey },
        });
        const data = await res.json();
        setRule(data);
        setName(data.name);
        setDescription(data.description || '');
        setPriority(data.priority || 0);
        setEnabled(data.enabled ?? true);
        setCooldownHours(data.cooldownSeconds ? data.cooldownSeconds / 3600 : 0);
        setConditions(data.conditions);
        setActions(data.actions);
      } catch (err) {
        console.error('Failed to fetch rule:', err);
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [params.id]);


  async function handleSave() {
    setSaving(true);
    try {
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      const payload = {
        name,
        description: description || undefined,
        enabled,
        priority,
        cooldownSeconds: cooldownHours * 3600,
        conditions,
        actions,
      };
      await fetch(`${API_URL}/v1/rules/${params.id}`, {
        method: 'PUT',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Failed to save rule:', err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12">Cargando...</div>;
  }

  if (!rule) {
    return <div className="text-center py-12">Regla no encontrada</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Editor de Regla</h1>
        <p className="text-muted-foreground text-sm mt-1">Configurá condiciones y acciones</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Nombre</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la regla" />
        </div>

        <div>
          <label className="text-sm font-medium">Descripción</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción opcional"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Prioridad</label>
            <Input
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
              min="0"
              max="100"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Cooldown (horas)</label>
            <Input
              type="number"
              value={cooldownHours}
              onChange={(e) => setCooldownHours(parseInt(e.target.value) || 0)}
              min="0"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border"
            />
            <span className="text-sm font-medium">Habilitada</span>
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-4">Condiciones</h2>
          <RuleBuilder value={conditions} onChange={setConditions} />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Acciones</h2>
          <ActionBuilder value={actions} onChange={setActions} />
        </div>
      </div>

      <div className="flex gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar Regla'}
        </Button>
        <Button variant="outline" onClick={() => window.history.back()}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
