import { describe, it, expect } from 'vitest';
import { evaluateGroup } from './evaluator.js';
import type { EventContext, ConditionGroup } from '@engage/core';

const baseContext: EventContext = {
  event: {
    id: 'evt_1',
    tenantId: 'tenant_1',
    type: 'prode.ranking.changed',
    userId: 'user_1',
    payload: { newRank: 1, previousRank: 5 },
    metadata: {},
    receivedAt: new Date(),
  },
  user: {
    id: 'user_1',
    externalId: 'ext_1',
    timezone: 'America/Argentina/Buenos_Aires',
    locale: 'es-AR',
    fatigueScore: 0.2,
    engagementScore: 0.8,
    metadata: {},
    isActiveSession: true,
    tags: [],
  },
  tenant: {
    id: 'tenant_1',
    slug: 'prodecaballito',
    settings: {},
  },
};

describe('evaluateGroup', () => {
  describe('AND', () => {
    it('returns true when all conditions match', () => {
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [
          { field: 'event.type', operator: 'eq', value: 'prode.ranking.changed' },
          { field: 'event.payload.newRank', operator: 'lte', value: 3 },
        ],
      };
      expect(evaluateGroup(group, baseContext)).toBe(true);
    });

    it('returns false when one condition fails', () => {
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [
          { field: 'event.type', operator: 'eq', value: 'prode.ranking.changed' },
          { field: 'event.payload.newRank', operator: 'eq', value: 10 },
        ],
      };
      expect(evaluateGroup(group, baseContext)).toBe(false);
    });

    it('short-circuits on first false', () => {
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [
          { field: 'event.type', operator: 'eq', value: 'wrong.type' },
          { field: 'event.payload.newRank', operator: 'eq', value: 1 },
        ],
      };
      expect(evaluateGroup(group, baseContext)).toBe(false);
    });
  });

  describe('OR', () => {
    it('returns true when any condition matches', () => {
      const group: ConditionGroup = {
        operator: 'OR',
        conditions: [
          { field: 'event.type', operator: 'eq', value: 'wrong.type' },
          { field: 'event.payload.newRank', operator: 'eq', value: 1 },
        ],
      };
      expect(evaluateGroup(group, baseContext)).toBe(true);
    });

    it('returns false when no conditions match', () => {
      const group: ConditionGroup = {
        operator: 'OR',
        conditions: [
          { field: 'event.type', operator: 'eq', value: 'wrong.type' },
          { field: 'event.payload.newRank', operator: 'eq', value: 99 },
        ],
      };
      expect(evaluateGroup(group, baseContext)).toBe(false);
    });
  });

  describe('nested groups', () => {
    it('evaluates nested AND inside OR', () => {
      const group: ConditionGroup = {
        operator: 'OR',
        conditions: [
          {
            operator: 'AND',
            conditions: [
              { field: 'event.type', operator: 'eq', value: 'prode.ranking.changed' },
              { field: 'event.payload.newRank', operator: 'lte', value: 3 },
            ],
          },
          { field: 'user.fatigueScore', operator: 'gt', value: 0.9 },
        ],
      };
      expect(evaluateGroup(group, baseContext)).toBe(true);
    });
  });

  describe('operators', () => {
    it('gt: true when value is greater', () => {
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'user.engagementScore', operator: 'gt', value: 0.5 }],
      };
      expect(evaluateGroup(group, baseContext)).toBe(true);
    });

    it('in: true when value is in array', () => {
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'event.type', operator: 'in', value: ['prode.ranking.changed', 'match.goal_scored'] }],
      };
      expect(evaluateGroup(group, baseContext)).toBe(true);
    });

    it('nin: true when value is not in array', () => {
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'event.type', operator: 'nin', value: ['some.other.event'] }],
      };
      expect(evaluateGroup(group, baseContext)).toBe(true);
    });

    it('contains: true when string contains substring', () => {
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'event.type', operator: 'contains', value: 'ranking' }],
      };
      expect(evaluateGroup(group, baseContext)).toBe(true);
    });

    it('neq: true when values differ', () => {
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'event.payload.newRank', operator: 'neq', value: 5 }],
      };
      expect(evaluateGroup(group, baseContext)).toBe(true);
    });

    it('exists: true when field is defined', () => {
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'event.payload.newRank', operator: 'exists', value: null }],
      };
      expect(evaluateGroup(group, baseContext)).toBe(true);
    });

    it('exists: false when field is undefined', () => {
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'event.payload.nonexistent', operator: 'exists', value: null }],
      };
      expect(evaluateGroup(group, baseContext)).toBe(false);
    });
  });

  describe('fatigue suppression rule', () => {
    it('triggers SUPPRESS when fatigue is high', () => {
      const highFatigueContext: EventContext = {
        ...baseContext,
        user: { ...baseContext.user, fatigueScore: 0.85 },
      };
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'user.fatigueScore', operator: 'gt', value: 0.8 }],
      };
      expect(evaluateGroup(group, highFatigueContext)).toBe(true);
    });

    it('does not trigger when fatigue is normal', () => {
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [{ field: 'user.fatigueScore', operator: 'gt', value: 0.8 }],
      };
      expect(evaluateGroup(group, baseContext)).toBe(false);
    });
  });
});
