'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';

interface ActionItem {
  type: string;
  params: Record<string, unknown>;
}

interface Props {
  value: unknown;
  onChange: (value: unknown) => void;
}

const ACTION_TYPES = [
  { label: 'Enviar Notificación', value: 'SEND_NOTIFICATION' },
  { label: 'Agregar a Campaña', value: 'ADD_TO_CAMPAIGN' },
  { label: 'Suprimir Notificaciones', value: 'SUPPRESS' },
  { label: 'Escalar', value: 'ESCALATE' },
  { label: 'Actualizar Score', value: 'UPDATE_SCORE' },
  { label: 'Iniciar Campaña de Voz', value: 'START_VOICE_CAMPAIGN' },
];

function ActionRow({
  action,
  onUpdate,
  onRemove,
}: {
  action: ActionItem;
  onUpdate: (action: ActionItem) => void;
  onRemove: () => void;
}) {
  const getParamsForType = (type: string) => {
    switch (type) {
      case 'SEND_NOTIFICATION':
        return ['channel', 'template'];
      case 'ADD_TO_CAMPAIGN':
        return ['campaignId'];
      case 'SUPPRESS':
        return ['duration'];
      case 'ESCALATE':
        return ['priority', 'reason'];
      case 'UPDATE_SCORE':
        return ['field', 'increment'];
      case 'START_VOICE_CAMPAIGN':
        return ['campaignId'];
      default:
        return [];
    }
  };

  const paramKeys = getParamsForType(action.type);

  return (
    <Card className="p-4 space-y-3">
      <Select value={action.type || ''} onValueChange={(type) => type && onUpdate({ type, params: {} })}>
        <SelectTrigger>
          <SelectValue placeholder="Tipo de acción" />
        </SelectTrigger>
        <SelectContent>
          {ACTION_TYPES.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="space-y-2">
        {paramKeys.map((key) => (
          <Input
            key={key}
            placeholder={key}
            value={String(action.params[key] ?? '')}
            onChange={(e) => {
              const newParams = { ...action.params };
              let val: unknown = e.target.value;
              if (!isNaN(Number(val)) && val !== '') val = Number(val);
              newParams[key] = val;
              onUpdate({ ...action, params: newParams });
            }}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

export function ActionBuilder({ value, onChange }: Props) {
  const actions: ActionItem[] = Array.isArray(value)
    ? value.filter((item): item is ActionItem => typeof item === 'object' && item !== null && 'type' in item)
    : [];

  const addAction = () => {
    const newAction: ActionItem = { type: '', params: {} };
    onChange([...actions, newAction]);
  };

  const updateAction = (index: number, action: ActionItem) => {
    const newActions = [...actions];
    newActions[index] = action;
    onChange(newActions);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {actions.map((action, idx) => (
        <ActionRow
          key={idx}
          action={action}
          onUpdate={(updated) => updateAction(idx, updated)}
          onRemove={() => removeAction(idx)}
        />
      ))}

      <Button onClick={addAction} variant="outline">
        <Plus className="h-4 w-4 mr-2" />
        Agregar Acción
      </Button>
    </div>
  );
}
