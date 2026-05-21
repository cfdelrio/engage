import { describe, it, expect } from "vitest";
import { RulesEngine, type StoredRule } from "./engine.js";
import type {
  EventContext,
  ProcessedEvent,
  UserContext,
  TenantContext,
  ConditionGroup,
} from "@engage/core";

function makeContext(overrides: {
  eventType?: string;
  payload?: Record<string, unknown>;
  fatigueScore?: number;
  tags?: string[];
}): EventContext {
  const event: ProcessedEvent = {
    id: "evt_test",
    tenantId: "tenant_test",
    type: overrides.eventType ?? "test.event",
    userId: "user_test",
    payload: overrides.payload ?? {},
    metadata: {},
    receivedAt: new Date(),
  };
  const user: UserContext = {
    id: "user_test",
    externalId: "ext_test",
    timezone: "UTC",
    locale: "en",
    tags: overrides.tags ?? [],
    fatigueScore: overrides.fatigueScore ?? 0,
    engagementScore: 0,
    metadata: {},
    isActiveSession: false,
  };
  const tenant: TenantContext = {
    id: "tenant_test",
    slug: "test",
    settings: {} as TenantContext["settings"],
  };
  return { event, user, tenant };
}

function makeRule(overrides: Partial<StoredRule>): StoredRule {
  return {
    id: overrides.id ?? "rule_test",
    name: overrides.name ?? "Test Rule",
    enabled: overrides.enabled ?? true,
    priority: overrides.priority ?? 0,
    conditions: overrides.conditions ?? {
      operator: "AND",
      conditions: [{ field: "event.type", operator: "eq", value: "match" }],
    },
    actions: overrides.actions ?? [
      { type: "SEND_NOTIFICATION", params: { channel: "email" } },
    ],
    cooldownSeconds: overrides.cooldownSeconds ?? null,
  };
}

describe("RulesEngine.evaluate", () => {
  const engine = new RulesEngine();

  it("returns matched=true with actions when conditions pass", () => {
    const ctx = makeContext({ eventType: "match" });
    const rule = makeRule({});
    const [result] = engine.evaluate([rule], ctx);
    expect(result?.matched).toBe(true);
    expect(result?.actions).toHaveLength(1);
    expect(result?.actions[0]?.type).toBe("SEND_NOTIFICATION");
  });

  it("returns matched=false with empty actions when conditions fail", () => {
    const ctx = makeContext({ eventType: "other" });
    const rule = makeRule({});
    const [result] = engine.evaluate([rule], ctx);
    expect(result?.matched).toBe(false);
    expect(result?.actions).toEqual([]);
  });

  it("filters out disabled rules", () => {
    const ctx = makeContext({ eventType: "match" });
    const rule = makeRule({ enabled: false });
    const results = engine.evaluate([rule], ctx);
    expect(results).toHaveLength(0);
  });

  it("evaluates rules in priority descending order", () => {
    const ctx = makeContext({ eventType: "match" });
    const lowPriority = makeRule({ id: "low", priority: 1 });
    const highPriority = makeRule({ id: "high", priority: 100 });
    const results = engine.evaluate([lowPriority, highPriority], ctx);
    expect(results[0]?.ruleId).toBe("high");
    expect(results[1]?.ruleId).toBe("low");
  });

  it("short-circuits on a matched SUPPRESS rule", () => {
    const ctx = makeContext({ eventType: "match" });
    const suppress = makeRule({
      id: "suppress",
      priority: 100,
      actions: [{ type: "SUPPRESS", params: {} }],
    });
    const later = makeRule({ id: "later", priority: 1 });
    const results = engine.evaluate([suppress, later], ctx);
    expect(results).toHaveLength(1);
    expect(results[0]?.ruleId).toBe("suppress");
  });

  it("does not short-circuit when SUPPRESS conditions fail", () => {
    const ctx = makeContext({ eventType: "other" });
    const suppress = makeRule({
      id: "suppress",
      priority: 100,
      actions: [{ type: "SUPPRESS", params: {} }],
    });
    const later = makeRule({
      id: "later",
      priority: 1,
      conditions: {
        operator: "AND",
        conditions: [{ field: "event.type", operator: "eq", value: "other" }],
      },
    });
    const results = engine.evaluate([suppress, later], ctx);
    expect(results).toHaveLength(2);
    expect(results[1]?.matched).toBe(true);
  });

  it("evaluates nested AND/OR groups", () => {
    const ctx = makeContext({
      eventType: "match",
      fatigueScore: 0.9,
      tags: ["vip"],
    });
    const conditions: ConditionGroup = {
      operator: "AND",
      conditions: [
        { field: "event.type", operator: "eq", value: "match" },
        {
          operator: "OR",
          conditions: [
            { field: "user.fatigueScore", operator: "gt", value: 0.8 },
            { field: "user.tags", operator: "contains", value: "vip" },
          ],
        } as ConditionGroup,
      ],
    };
    const rule = makeRule({ conditions });
    const [result] = engine.evaluate([rule], ctx);
    expect(result?.matched).toBe(true);
  });
});

describe("RulesEngine.collectActions", () => {
  const engine = new RulesEngine();

  it("flattens actions from matched rules only", () => {
    const ctx = makeContext({ eventType: "match" });
    const matching = makeRule({ id: "a", priority: 10 });
    const notMatching = makeRule({
      id: "b",
      priority: 5,
      conditions: {
        operator: "AND",
        conditions: [{ field: "event.type", operator: "eq", value: "other" }],
      },
      actions: [{ type: "ESCALATE", params: {} }],
    });
    const results = engine.evaluate([matching, notMatching], ctx);
    const actions = engine.collectActions(results);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe("SEND_NOTIFICATION");
  });
});
