'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';

interface Condition {
  field: string;
  operator: string;
  value: unknown;
}

interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: (Condition | ConditionGroup)[];
}

interface Props {
  value: unknown;
  onChange: (value: unknown) => void;
}

const FIELD_OPTIONS = [
  { label: 'Tipo de evento', value: 'event.type' },
  { label: 'ID de usuario', value: 'event.userId' },
  { label: 'Score de fatiga del usuario', value: 'user.fatigueScore' },
  { label: 'Último evento visto', value: 'user.lastSeenAt' },
  { label: 'Payload del evento', value: 'event.payload' },
  { label: 'Metadata del usuario', value: 'user.metadata' },
];

const OPERATOR_OPTIONS = [
  { label: 'Igual a', value: 'eq' },
  { label: 'No igual a', value: 'neq' },
  { label: 'Mayor que', value: 'gt' },
  { label: 'Menor que', value: 'lt' },
  { label: 'Mayor o igual', value: 'gte' },
  { label: 'Menor o igual', value: 'lte' },
  { label: 'Contiene', value: 'contains' },
  { label: 'En lista', value: 'in' },
  { label: 'Cambió', value: 'changed' },
];

function isCondition(item: unknown): item is Condition {
  return typeof item === 'object' && item !== null && 'field' in item && 'operator' in item;
}

function isConditionGroup(item: unknown): item is ConditionGroup {
  return typeof item === 'object' && item !== null && 'operator' in item && 'conditions' in item;
}

function ConditionRow({
  condition,
  onUpdate,
  onRemove,
}: {
  condition: Condition;
  onUpdate: (condition: Condition) => void;
  onRemove: () => void;
}) {
  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Select value={condition.field} onValueChange={(field) => onUpdate({ ...condition, field })}>
          <SelectTrigger>
            <SelectValue placeholder="Campo" />
          </SelectTrigger>
          <SelectContent>
            {FIELD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={condition.operator} onValueChange={(operator) => onUpdate({ ...condition, operator })}>
          <SelectTrigger>
            <SelectValue placeholder="Operador" />
          </SelectTrigger>
          <SelectContent>
            {OPERATOR_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={String(condition.value ?? '')}
          onChange={(e) => {
            let val: unknown = e.target.value;
            if (!isNaN(Number(val)) && val !== '') val = Number(val);
            onUpdate({ ...condition, value: val });
          }}
          placeholder="Valor"
        />
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function ConditionGroupComp({
  group,
  onUpdate,
  onRemove,
  depth = 0,
}: {
  group: ConditionGroup;
  onUpdate: (group: ConditionGroup) => void;
  onRemove: () => void;
  depth?: number;
}) {
  const addCondition = () => {
    const newCondition: Condition = { field: '', operator: 'eq', value: '' };
    onUpdate({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  };

  const addGroup = () => {
    const newGroup: ConditionGroup = { operator: 'AND', conditions: [] };
    onUpdate({
      ...group,
      conditions: [...group.conditions, newGroup],
    });
  };

  const updateCondition = (index: number, condition: Condition) => {
    const newConditions = [...group.conditions];
    newConditions[index] = condition;
    onUpdate({ ...group, conditions: newConditions });
  };

  const updateNestedGroup = (index: number, nestedGroup: ConditionGroup) => {
    const newConditions = [...group.conditions];
    newConditions[index] = nestedGroup;
    onUpdate({ ...group, conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    onUpdate({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== index),
    });
  };

  const borderClass = depth === 0 ? 'border-2 border-blue-200' : 'border-2 border-orange-200';
  const bgClass = depth === 0 ? 'bg-blue-50' : 'bg-orange-50';

  return (
    <Card className={`p-4 space-y-4 ${borderClass} ${bgClass}`}>
      <div className="flex items-center justify-between">
        <Select value={group.operator} onValueChange={(operator) => onUpdate({ ...group, operator: operator as 'AND' | 'OR' })}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">AND</SelectItem>
            <SelectItem value="OR">OR</SelectItem>
          </SelectContent>
        </Select>

        {depth > 0 && (
          <Button size="sm" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {group.conditions.map((cond, idx) =>
          isCondition(cond) ? (
            <ConditionRow
              key={idx}
              condition={cond}
              onUpdate={(updated) => updateCondition(idx, updated)}
              onRemove={() => removeCondition(idx)}
            />
          ) : isConditionGroup(cond) ? (
            <ConditionGroupComp
              key={idx}
              group={cond}
              onUpdate={(updated) => updateNestedGroup(idx, updated)}
              onRemove={() => removeCondition(idx)}
              depth={depth + 1}
            />
          ) : null,
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={addCondition} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Condición
        </Button>
        <Button size="sm" onClick={addGroup} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Grupo
        </Button>
      </div>
    </Card>
  );
}

export function RuleBuilder({ value, onChange }: Props) {
  const group: ConditionGroup =
    value && isConditionGroup(value)
      ? value
      : {
          operator: 'AND',
          conditions: [],
        };

  return <ConditionGroupComp group={group} onUpdate={onChange} onRemove={() => {}} />;
}
