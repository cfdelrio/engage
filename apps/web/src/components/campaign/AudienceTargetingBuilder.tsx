'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ConditionOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin' | 'contains' | 'changed' | 'exists';

interface Condition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Array<Condition | ConditionGroup>;
}

const AVAILABLE_FIELDS = [
  { label: 'Event Type', value: 'event.type', type: 'string' },
  { label: 'User Fatigue Score', value: 'user.fatigueScore', type: 'number' },
  { label: 'User Rank', value: 'user.rank', type: 'number' },
  { label: 'User Country', value: 'user.country', type: 'string' },
  { label: 'User Language', value: 'user.language', type: 'string' },
  { label: 'Days Inactive', value: 'user.daysInactive', type: 'number' },
  { label: 'Last Seen At', value: 'user.lastSeenAt', type: 'date' },
  { label: 'Total Engagements', value: 'user.totalEngagements', type: 'number' },
  { label: 'Open Rate (30d)', value: 'user.openRate30d', type: 'number' },
  { label: 'Click Rate (30d)', value: 'user.clickRate30d', type: 'number' },
];

const OPERATORS_BY_TYPE: Record<string, ConditionOperator[]> = {
  string: ['eq', 'neq', 'contains', 'in', 'nin'],
  number: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'],
  date: ['eq', 'neq', 'gt', 'lt'],
  default: ['eq', 'neq', 'exists'],
};

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: 'equals',
  neq: 'not equals',
  gt: 'greater than',
  lt: 'less than',
  gte: 'greater or equal',
  lte: 'less or equal',
  in: 'in list',
  nin: 'not in list',
  contains: 'contains',
  changed: 'changed',
  exists: 'exists',
};

interface ConditionRowProps {
  condition: Condition;
  onUpdate: (condition: Condition) => void;
  onRemove: () => void;
}

function ConditionRow({ condition, onUpdate, onRemove }: ConditionRowProps) {
  const fieldConfig = AVAILABLE_FIELDS.find((f) => f.value === condition.field);
  const fieldType = fieldConfig?.type || 'default';
  const operators = OPERATORS_BY_TYPE[fieldType] || OPERATORS_BY_TYPE.default;

  return (
    <div className="flex gap-2 items-end p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex-1">
        <Label className="text-xs">Field</Label>
        <Select value={condition.field} onValueChange={(field) => onUpdate({ ...condition, field })}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AVAILABLE_FIELDS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1">
        <Label className="text-xs">Operator</Label>
        <Select value={condition.operator} onValueChange={(op) => onUpdate({ ...condition, operator: op as ConditionOperator })}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!['exists', 'changed'].includes(condition.operator) && (
        <div className="flex-1">
          <Label className="text-xs">Value</Label>
          <Input
            type={fieldType === 'number' ? 'number' : 'text'}
            value={String(condition.value || '')}
            onChange={(e) => {
              const value = fieldType === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
              onUpdate({ ...condition, value });
            }}
            className="h-8 text-sm"
            placeholder="Enter value"
          />
        </div>
      )}

      <Button size="sm" variant="outline" onClick={onRemove} className="h-8">
        Remove
      </Button>
    </div>
  );
}

interface ConditionGroupEditorProps {
  group: ConditionGroup;
  onUpdate: (group: ConditionGroup) => void;
  onRemove?: () => void;
  level?: number;
}

function ConditionGroupEditor({ group, onUpdate, onRemove, level = 0 }: ConditionGroupEditorProps) {
  const isRoot = level === 0;

  const handleAddCondition = () => {
    const newCondition: Condition = {
      field: AVAILABLE_FIELDS[0].value,
      operator: 'eq',
      value: '',
    };
    onUpdate({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  };

  const handleAddGroup = () => {
    const newGroup: ConditionGroup = {
      operator: 'AND',
      conditions: [
        {
          field: AVAILABLE_FIELDS[0].value,
          operator: 'eq',
          value: '',
        },
      ],
    };
    onUpdate({
      ...group,
      conditions: [...group.conditions, newGroup],
    });
  };

  const handleUpdateCondition = (index: number, updated: Condition) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updated;
    onUpdate({ ...group, conditions: newConditions });
  };

  const handleRemoveCondition = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    onUpdate({ ...group, conditions: newConditions });
  };

  const handleUpdateGroup = (index: number, updated: ConditionGroup) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updated;
    onUpdate({ ...group, conditions: newConditions });
  };

  const handleRemoveGroup = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    onUpdate({ ...group, conditions: newConditions });
  };

  return (
    <Card className={cn('border-slate-200', !isRoot && 'border-blue-200 bg-blue-50')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm">
              {isRoot ? 'Audience Targeting' : 'Nested Group'}
            </CardTitle>
            <Select value={group.operator} onValueChange={(op) => onUpdate({ ...group, operator: op as 'AND' | 'OR' })}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isRoot && onRemove && (
            <Button size="sm" variant="destructive" onClick={onRemove}>
              Remove Group
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {group.conditions.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No conditions yet</p>
        ) : (
          group.conditions.map((cond, idx) => (
            <div key={idx}>
              {idx > 0 && (
                <div className="flex justify-center my-2">
                  <Badge variant="outline" className="text-xs">
                    {group.operator}
                  </Badge>
                </div>
              )}
              {typeof cond.operator === 'string' ? (
                <ConditionRow
                  condition={cond as Condition}
                  onUpdate={(updated) => handleUpdateCondition(idx, updated)}
                  onRemove={() => handleRemoveCondition(idx)}
                />
              ) : (
                <ConditionGroupEditor
                  group={cond as ConditionGroup}
                  onUpdate={(updated) => handleUpdateGroup(idx, updated)}
                  onRemove={() => handleRemoveGroup(idx)}
                  level={level + 1}
                />
              )}
            </div>
          ))
        )}

        <Separator />

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleAddCondition} variant="outline">
            + Add Condition
          </Button>
          <Button size="sm" onClick={handleAddGroup} variant="outline">
            + Add Group
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface AudienceTargetingBuilderProps {
  value?: any; // Accept any shape, we'll handle type safety inside
  onChange: (group: ConditionGroup) => void;
}

export function AudienceTargetingBuilder({ value, onChange }: AudienceTargetingBuilderProps) {
  const [group, setGroup] = useState<ConditionGroup>(
    (value as ConditionGroup) || {
      operator: 'AND',
      conditions: [],
    }
  );

  const handleUpdate = (updated: ConditionGroup) => {
    setGroup(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Who should receive this campaign?</h3>
        <p className="text-xs text-slate-600 mb-4">
          Define audience segments using conditions. Combine with AND/OR logic for complex targeting.
        </p>
      </div>

      <ConditionGroupEditor group={group} onUpdate={handleUpdate} />

      {group.conditions.length > 0 && (
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-xs bg-white p-2 rounded block border border-slate-200 overflow-auto max-h-40">
              {JSON.stringify(group, null, 2)}
            </code>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
