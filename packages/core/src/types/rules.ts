export type ConditionOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin' | 'contains' | 'changed' | 'exists';

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Array<Condition | ConditionGroup>;
}

export type RuleActionType =
  | 'SEND_NOTIFICATION'
  | 'ADD_TO_CAMPAIGN'
  | 'SUPPRESS'
  | 'ESCALATE'
  | 'UPDATE_SCORE'
  | 'TRIGGER_WEBHOOK';

export interface RuleAction {
  type: RuleActionType;
  params: Record<string, unknown>;
}

export interface RuleDefinition {
  conditions: ConditionGroup;
  actions: RuleAction[];
}

export interface RuleEvaluationResult {
  ruleId: string;
  matched: boolean;
  actions: RuleAction[];
  reasoning: string;
}
