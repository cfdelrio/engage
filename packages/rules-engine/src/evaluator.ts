import type { Condition, ConditionGroup, ConditionOperator, EventContext } from '@engage/core';

function getFieldValue(path: string, context: EventContext): unknown {
  const parts = path.split('.');
  let current: unknown = context;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateCondition(condition: Condition, context: EventContext): boolean {
  const value = getFieldValue(condition.field, context);
  const target = condition.value;

  switch (condition.operator as ConditionOperator) {
    case 'eq':
      return value === target;
    case 'neq':
      return value !== target;
    case 'gt':
      return typeof value === 'number' && typeof target === 'number' && value > target;
    case 'lt':
      return typeof value === 'number' && typeof target === 'number' && value < target;
    case 'gte':
      return typeof value === 'number' && typeof target === 'number' && value >= target;
    case 'lte':
      return typeof value === 'number' && typeof target === 'number' && value <= target;
    case 'in':
      return Array.isArray(target) && target.includes(value);
    case 'nin':
      return Array.isArray(target) && !target.includes(value);
    case 'contains':
      return typeof value === 'string' && typeof target === 'string' && value.includes(target);
    case 'exists':
      return value !== undefined && value !== null;
    case 'changed':
      // Requires context.event.payload to have both value and previousValue
      // Convention: payload.{field} = new, payload.previous{Field} = old
      return true; // Simplified — full implementation checks event payload diff
    default:
      return false;
  }
}

export function evaluateGroup(group: ConditionGroup, context: EventContext): boolean {
  if (group.operator === 'AND') {
    for (const cond of group.conditions) {
      const result = 'conditions' in cond
        ? evaluateGroup(cond as ConditionGroup, context)
        : evaluateCondition(cond as Condition, context);
      if (!result) return false; // short-circuit
    }
    return true;
  }

  // OR
  for (const cond of group.conditions) {
    const result = 'conditions' in cond
      ? evaluateGroup(cond as ConditionGroup, context)
      : evaluateCondition(cond as Condition, context);
    if (result) return true; // short-circuit
  }
  return false;
}
