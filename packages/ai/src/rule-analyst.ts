import { z } from "zod";
import type { AIProviderRegistry } from "./provider-registry.js";
import { assertNoInjection } from "./utils/sanitize.js";

export interface SerializedRule {
  id: string;
  name: string;
  description?: string;
  conditions: unknown;
  actions: unknown;
  enabled: boolean;
  priority: number;
}

export interface RuleStat {
  total: number;
  matched: number;
  matchRate: number;
  lastExecutedAt: string | null;
}

export type RuleStatsMap = Record<string, RuleStat>;

const RESPONSE_SCHEMA = z.object({
  answer: z.string(),
  matchedRuleIds: z.array(z.string()).nullable(),
  insights: z.array(z.string()).nullable(),
});

export type RuleAnalysis = z.infer<typeof RESPONSE_SCHEMA>;

function serializeConditions(conditions: unknown): string {
  if (
    typeof conditions !== "object" ||
    conditions === null ||
    !("operator" in conditions)
  ) {
    return String(conditions);
  }
  const g = conditions as { operator: string; conditions: unknown[] };
  if (!Array.isArray(g.conditions)) return String(conditions);
  const parts = g.conditions.map((c) => {
    if (typeof c === "object" && c !== null && "conditions" in c) {
      return `(${serializeConditions(c)})`;
    }
    const leaf = c as { field: string; operator: string; value?: unknown };
    const val =
      leaf.value !== undefined ? ` ${JSON.stringify(leaf.value)}` : "";
    return `${leaf.field} ${leaf.operator}${val}`;
  });
  return parts.join(` ${g.operator} `);
}

function serializeActions(actions: unknown): string {
  if (!Array.isArray(actions)) return "none";
  return actions
    .map((a: { type: string; params?: Record<string, unknown> }) => {
      const channel = a.params?.["channel"] ? ` → ${a.params["channel"]}` : "";
      return `${a.type}${channel}`;
    })
    .join(", ");
}

function buildRuleCatalog(
  rules: SerializedRule[],
  stats?: RuleStatsMap,
): string {
  return rules
    .map((r) => {
      const stat = stats?.[r.id];
      const statStr = stat
        ? ` [executions: ${stat.total}, match_rate: ${Math.round(stat.matchRate * 100)}%, last: ${stat.lastExecutedAt ?? "never"}]`
        : "";
      const status = r.enabled ? "enabled" : "disabled";
      return `Rule "${r.name}" (id=${r.id}, priority=${r.priority}, ${status}${statStr}): IF ${serializeConditions(r.conditions)} THEN ${serializeActions(r.actions)}${r.description ? ` — ${r.description}` : ""}`;
    })
    .join("\n");
}

const SYSTEM_PROMPT = `You are an analyst for ORKESTAI ENGAGE, an engagement automation platform.
You receive a list of rules (IF/THEN automation rules) and optional execution statistics, and you answer questions about them in natural language.

Your capabilities:
1. **Filter/search**: If the user asks to find rules matching certain criteria, return matchedRuleIds with the IDs of matching rules.
2. **Analytics**: If the user asks behavioral questions (which rule fired most, best match rate, etc.), use the execution stats in your answer.
3. **Explanation**: Explain what rules do in plain language.

Output — respond with ONLY this JSON, no markdown fences:
{
  "answer": "Your natural language answer (1-3 sentences, be specific)",
  "matchedRuleIds": ["id1", "id2"] or null (null if not a filter query),
  "insights": ["insight1", "insight2"] or null (1-3 bullet insights if relevant, else null)
}

Rules:
- Only reference rule IDs that exist in the catalog provided.
- Never invent data. If stats are not available, say so.
- If the question is ambiguous, answer the most likely interpretation.
- matchedRuleIds should be null for analytics/explanation questions, and an array (possibly empty) for search/filter questions.`;

export class RuleAnalyst {
  constructor(private readonly registry: AIProviderRegistry) {}

  async query(
    question: string,
    tenantId: string,
    rules: SerializedRule[],
    stats?: RuleStatsMap,
    conversationHistory?: Array<{
      role: "user" | "assistant";
      content: string;
    }>,
  ): Promise<RuleAnalysis> {
    assertNoInjection(question);

    const provider = this.registry.resolve(tenantId);
    const catalog = buildRuleCatalog(rules, stats);

    let userPrompt = `Rules catalog:\n${catalog}\n\nQuestion: ${question}`;
    if (conversationHistory && conversationHistory.length > 0) {
      const historyText = conversationHistory
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n");
      userPrompt = `Rules catalog:\n${catalog}\n\nConversation:\n${historyText}\nUser: ${question}`;
    }

    const response = await provider.complete({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      schema: {},
      temperature: 0.3,
      maxTokens: 512,
      cacheControl: true,
    });

    return this.validateOutput(response.content);
  }

  private validateOutput(raw: string): RuleAnalysis {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```$/m, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const err = new Error(
        `AI response is not valid JSON: ${raw.slice(0, 200)}`,
      ) as Error & { code: string };
      err.code = "AI_PARSE_ERROR";
      throw err;
    }

    const result = RESPONSE_SCHEMA.safeParse(parsed);
    if (!result.success) {
      const err = new Error(
        `AI response failed validation: ${result.error.message}`,
      ) as Error & { code: string };
      err.code = "AI_PARSE_ERROR";
      throw err;
    }

    return result.data;
  }
}
