import { z } from "zod";
import type { AIProviderRegistry } from "./provider-registry.js";
import type { AIProviderName } from "@engage/core";
import { assertNoInjection } from "./utils/sanitize.js";

// --- Zod schemas (mirrors rules.ts shapes; local to avoid cross-package coupling) ---

const conditionOperatorSchema = z.enum([
  "eq",
  "neq",
  "gt",
  "lt",
  "gte",
  "lte",
  "in",
  "nin",
  "contains",
  "changed",
  "exists",
]);

const conditionLeafSchema = z.object({
  field: z.string(),
  operator: conditionOperatorSchema,
  value: z.unknown().optional(),
});

type ConditionNode =
  | z.infer<typeof conditionLeafSchema>
  | { operator: "AND" | "OR"; conditions: ConditionNode[] };

const conditionNodeSchema: z.ZodType<ConditionNode> = z.lazy(() =>
  z.union([
    conditionLeafSchema,
    z.object({
      operator: z.enum(["AND", "OR"]),
      conditions: z.array(conditionNodeSchema),
    }),
  ]),
);

const conditionGroupSchema = z.object({
  operator: z.enum(["AND", "OR"]),
  conditions: z.array(conditionNodeSchema),
});

const actionSchema = z.object({
  type: z.enum([
    "SEND_NOTIFICATION",
    "ADD_TO_CAMPAIGN",
    "SUPPRESS",
    "ESCALATE",
    "UPDATE_SCORE",
    "TRIGGER_WEBHOOK",
  ]),
  params: z.record(z.unknown()),
});

const RULE_INTERPRETATION_SCHEMA = z.object({
  rule: z
    .object({
      name: z.string().min(1).max(256),
      description: z.string().optional(),
      conditions: conditionGroupSchema,
      actions: z.array(actionSchema).min(1),
      cooldownSeconds: z.number().int().optional().nullable(),
    })
    .optional(),
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().optional().nullable(),
});

export type RuleInterpretation = z.infer<typeof RULE_INTERPRETATION_SCHEMA>;

const SYSTEM_PROMPT = `You are a rules engine interpreter for ORKESTAI ENGAGE, a B2B engagement automation platform.
Your ONLY job is to convert natural language rule descriptions into structured JSON rule definitions.
You must NEVER hallucinate fields, operators, or action types that are not in the lists below.

## Available condition fields (dot-notation)
- event.type — string, the event type name (e.g., "prode.ranking.changed", "user.inactive")
- event.payload.* — any field in the event payload (e.g., event.payload.newRank)
- user.fatigueScore — number 0-1 (higher = more fatigued / notified recently)
- user.engagementScore — number (higher = more engaged)
- user.isActiveSession — boolean (true if user is currently online)
- user.locale — string (e.g., "es", "en")
- user.metadata.* — any field in user metadata
- user.lastSeenAt — ISO datetime string

## Available operators
- eq: strict equality  → { "field": "event.type", "operator": "eq", "value": "user.inactive" }
- neq: not equal
- gt: greater than (numbers)
- lt: less than (numbers)
- gte: greater than or equal (numbers)
- lte: less than or equal (numbers)
- in: value is in array  → { "field": "event.type", "operator": "in", "value": ["a","b"] }
- nin: value not in array
- contains: string substring  → { "field": "event.type", "operator": "contains", "value": "ranking" }
- exists: field is not null/undefined (no value field needed)
- changed: field changed from previous value (no value field needed)

## Available action types — ONLY these 6 are valid, never use others
- SEND_NOTIFICATION — params: { channel: "email"|"sms"|"push"|"whatsapp"|"voice", templateId?: string }
- ADD_TO_CAMPAIGN — params: { campaignId: string }
- SUPPRESS — params: {} — stops further rule processing for this event
- ESCALATE — params: { severity: "low"|"medium"|"high", reason: string }
- UPDATE_SCORE — params: { scoreType: "engagement"|"fatigue", delta: number }
- TRIGGER_WEBHOOK — params: { url: string, method: "POST"|"GET" }

## Output — respond with ONLY this JSON, no markdown fences, no extra text
{
  "rule": {
    "name": "Short descriptive name (max 50 chars)",
    "description": "What this rule does and why",
    "conditions": {
      "operator": "AND",
      "conditions": [ ...array of condition leaf or nested group... ]
    },
    "actions": [ ...array of actions... ],
    "cooldownSeconds": null
  },
  "explanation": "Human-friendly 2-3 sentence explanation",
  "confidence": 0.0-1.0,
  "needsClarification": false,
  "clarificationQuestion": null
}

If the request is ambiguous and you cannot create a reasonable rule, set needsClarification=true,
omit the "rule" field entirely, and provide clarificationQuestion.
If you CAN create a rule (even if imperfect), set needsClarification=false and include the rule.

## Few-shot examples

User: "send email when user hasn't been active for 7 days"
{"rule":{"name":"Email inactive users","description":"Sends email on user.inactive event","conditions":{"operator":"AND","conditions":[{"field":"event.type","operator":"eq","value":"user.inactive"}]},"actions":[{"type":"SEND_NOTIFICATION","params":{"channel":"email"}}],"cooldownSeconds":86400},"explanation":"This rule fires when a user.inactive event is received and sends an email notification. A 24-hour cooldown prevents duplicate sends for the same user.","confidence":0.92,"needsClarification":false,"clarificationQuestion":null}

User: "when ranking changes and user is in top 3, send whatsapp and increase engagement"
{"rule":{"name":"Top 3 ranking celebration","description":"WhatsApp + score boost when user reaches top 3","conditions":{"operator":"AND","conditions":[{"field":"event.type","operator":"eq","value":"prode.ranking.changed"},{"field":"event.payload.newRank","operator":"lte","value":3}]},"actions":[{"type":"SEND_NOTIFICATION","params":{"channel":"whatsapp"}},{"type":"UPDATE_SCORE","params":{"scoreType":"engagement","delta":0.1}}],"cooldownSeconds":3600},"explanation":"Fires when a ranking change event shows position 3 or better. Sends WhatsApp and increases engagement score by 0.1.","confidence":0.95,"needsClarification":false,"clarificationQuestion":null}`;

export class RuleInterpreter {
  constructor(private readonly registry: AIProviderRegistry) {}

  async interpret(
    message: string,
    tenantId: string,
    conversationHistory?: Array<{
      role: "user" | "assistant";
      content: string;
    }>,
    tenantConfigProvider?: AIProviderName,
  ): Promise<RuleInterpretation> {
    this.sanitizeInput(message);

    const provider = this.registry.resolve(tenantId, tenantConfigProvider);

    let userPrompt = message;
    if (conversationHistory && conversationHistory.length > 0) {
      const historyText = conversationHistory
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n");
      userPrompt = `${historyText}\nUser: ${message}`;
    }

    const response = await provider.complete({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      schema: {},
      temperature: 0.2,
      maxTokens: 1024,
      cacheControl: true,
    });

    return this.validateOutput(response.content);
  }

  sanitizeInput(input: string): void {
    assertNoInjection(input);
  }

  private validateOutput(raw: string): RuleInterpretation {
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

    const result = RULE_INTERPRETATION_SCHEMA.safeParse(parsed);
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
