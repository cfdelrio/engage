import type { EventContext, RuleDefinition, RuleEvaluationResult, RuleAction, ConditionGroup } from '@engage/core';
import { evaluateGroup } from './evaluator.js';

export interface StoredRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: ConditionGroup;
  actions: RuleAction[];
  cooldownSeconds?: number | null;
}

export class RulesEngine {
  evaluate(rules: StoredRule[], context: EventContext): RuleEvaluationResult[] {
    const sorted = [...rules]
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    const results: RuleEvaluationResult[] = [];

    for (const rule of sorted) {
      const definition: RuleDefinition = {
        conditions: rule.conditions,
        actions: rule.actions,
      };

      const matched = evaluateGroup(definition.conditions, context);

      results.push({
        ruleId: rule.id,
        matched,
        actions: matched ? definition.actions : [],
        reasoning: matched
          ? `Rule "${rule.name}" matched with priority ${rule.priority}`
          : `Rule "${rule.name}" did not match`,
      });

      // If this is a SUPPRESS action and it matched, stop processing lower-priority rules
      if (matched && rule.actions.some((a) => a.type === 'SUPPRESS')) {
        break;
      }
    }

    return results;
  }

  collectActions(results: RuleEvaluationResult[]): RuleAction[] {
    return results.filter((r) => r.matched).flatMap((r) => r.actions);
  }
}
