'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { RuleBuilder } from '../_components/RuleBuilder';
import { ActionBuilder } from '../_components/ActionBuilder';
import { Trash2, AlertCircle, CheckCircle } from 'lucide-react';

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
  const router = useRouter();
  const [rule, setRule] = useState<Rule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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
    setMessage(null);
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
      const res = await fetch(`${API_URL}/v1/rules/${params.id}`, {
        method: 'PUT',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Regla guardada exitosamente' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Error al guardar la regla' });
      }
    } catch (err) {
      console.error('Failed to save rule:', err);
      setMessage({ type: 'error', text: 'Error al conectar con el servidor' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Estás seguro de que querés eliminar esta regla?')) return;

    setDeleting(true);
    try {
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      const res = await fetch(`${API_URL}/v1/rules/${params.id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey },
      });
      if (res.ok) {
        router.push('/dashboard/rules');
      } else {
        setMessage({ type: 'error', text: 'Error al eliminar la regla' });
      }
    } catch (err) {
      console.error('Failed to delete rule:', err);
      setMessage({ type: 'error', text: 'Error al conectar con el servidor' });
    } finally {
      setDeleting(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Editor de Regla</h1>
          <p className="text-muted-foreground text-sm mt-1">Configurá condiciones y acciones</p>
        </div>
        {enabled && <Badge className="bg-green-100 text-green-800">Activa</Badge>}
      </div>

      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

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

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-4">Condiciones (IF)</h2>
            <RuleBuilder value={conditions} onChange={setConditions} />
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Acciones (THEN)</h2>
            <ActionBuilder value={actions} onChange={setActions} />
          </div>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Estado</p>
                <Badge className={enabled ? 'bg-green-100 text-green-800' : 'bg-gray-200'}>
                  {enabled ? 'Habilitada' : 'Deshabilitada'}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Prioridad</p>
                <p className="text-sm font-semibold">{priority}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Cooldown</p>
                <p className="text-sm font-semibold">{cooldownHours > 0 ? `${cooldownHours}h` : 'Sin cooldown'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Condiciones</p>
                <p className="text-sm font-semibold">
                  {typeof conditions === 'object' &&
                  conditions !== null &&
                  'conditions' in conditions &&
                  Array.isArray((conditions as { conditions: unknown }).conditions)
                    ? (conditions as { conditions: unknown[] }).conditions.length
                    : 0}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Acciones</p>
                <p className="text-sm font-semibold">{Array.isArray(actions) ? actions.length : 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex gap-4 justify-between">
        <div className="flex gap-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Regla'}
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard/rules')}>
            Volver
          </Button>
        </div>
        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
          <Trash2 className="h-4 w-4 mr-2" />
          {deleting ? 'Eliminando...' : 'Eliminar'}
        </Button>
      </div>
    </div>
  );
}
