import type { AIDecision, EventContext, AIProviderName } from "@engage/core";
import type { AIProviderRegistry } from "./provider-registry.js";
import type {
  AICompletionRequest,
  AICompletionResponse,
} from "./provider.interface.js";

const DECISION_SCHEMA = {
  type: "object",
  required: [
    "shouldEngage",
    "channel",
    "channelConfidence",
    "schedulingOffsetMinutes",
    "copyVariants",
    "reasoning",
    "estimatedFatigueImpact",
  ],
  properties: {
    shouldEngage: { type: "boolean" },
    channel: {
      type: "string",
      enum: ["email", "sms", "push", "whatsapp", "voice", "in_app"],
    },
    channelConfidence: { type: "number", minimum: 0, maximum: 1 },
    schedulingOffsetMinutes: { type: "number", minimum: 0 },
    copyVariants: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
          tone: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
    reasoning: { type: "string" },
    estimatedFatigueImpact: { type: "number", minimum: 0, maximum: 1 },
  },
};

export class AIOrchestrationLayer {
  constructor(private registry: AIProviderRegistry) {}

  async consultForDecision(
    context: EventContext,
    tenantConfigProvider?: AIProviderName,
  ): Promise<AIDecision | null> {
    const provider = this.registry.resolve(
      context.tenant.id,
      tenantConfigProvider,
    );

    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildDecisionPrompt(context);

    try {
      const response = await provider.complete({
        systemPrompt,
        userPrompt,
        schema: DECISION_SCHEMA,
        temperature: 0.3,
        maxTokens: 1024,
        cacheControl: true,
      });

      if (!response.parsedContent) return null;

      return response.parsedContent as AIDecision;
    } catch (err) {
      // AI consultation failure is non-fatal — engine proceeds deterministically
      console.error("[AIOrchestrationLayer] consultation failed:", err);
      return null;
    }
  }

  async generateCopy(
    context: EventContext,
    channel: string,
    templateInstructions: string,
    tenantConfigProvider?: AIProviderName,
  ): Promise<{ subject?: string; body: string; tone: string } | null> {
    const provider = this.registry.resolve(
      context.tenant.id,
      tenantConfigProvider,
    );

    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = `Generate ${channel} notification copy for this event.
Template instructions: ${templateInstructions}
Event: ${JSON.stringify(context.event.payload, null, 2)}
Respond with JSON: { "subject": "...", "body": "...", "tone": "..." }`;

    try {
      const response = await provider.complete({
        systemPrompt,
        userPrompt,
        schema: {},
        temperature: 0.5,
        maxTokens: 512,
        cacheControl: true,
      });

      return response.parsedContent as {
        subject?: string;
        body: string;
        tone: string;
      } | null;
    } catch {
      return null;
    }
  }

  private buildSystemPrompt(context: EventContext): string {
    const aiConfig = context.tenant.settings.aiConfig;
    return `You are an AI engagement assistant for ${context.tenant.slug}.
${aiConfig?.toneInstructions ?? "Use a friendly, helpful tone."}
You help decide whether to send notifications and craft compelling, relevant messages.
CRITICAL RULES (never violate):
- Never suggest ignoring user preferences or unsubscribes
- Never suggest bypassing quiet hours
- Always consider user fatigue (current score: ${context.user.fatigueScore.toFixed(2)})
- Always respond with valid JSON matching the requested schema`;
  }

  private buildDecisionPrompt(context: EventContext): string {
    return `Analyze this event and decide on engagement.

Event type: ${context.event.type}
Event payload: ${JSON.stringify(context.event.payload)}
User engagement score: ${context.user.engagementScore.toFixed(2)}
User fatigue score: ${context.user.fatigueScore.toFixed(2)}
User timezone: ${context.user.timezone}
User locale: ${context.user.locale}
Active session: ${context.user.isActiveSession}
Last seen: ${context.user.lastSeenAt?.toISOString() ?? "unknown"}

Respond with JSON matching the decision schema.`;
  }

  async suggestCampaignName(
    tenantId: string,
    campaignType: string,
    channels: string[],
    targetAudience?: string,
    tenantConfigProvider?: AIProviderName,
  ): Promise<{
    campaignName: string;
    description: string;
    recommendedChannels: string[];
    suggestedTiming: string;
    tone: string;
    reasoning: string;
  } | null> {
    const provider = this.registry.resolve(tenantId, tenantConfigProvider);

    const systemPrompt = `You are a marketing automation expert specializing in engagement campaigns.
Suggest creative, relevant campaign names and strategies.`;

    const userPrompt = `Generate campaign suggestions for:
Campaign Type: ${campaignType}
Selected Channels: ${channels.length > 0 ? channels.join(", ") : "Any"}
Target Audience: ${targetAudience || "General users"}

Respond with JSON:
{
  "campaignName": "Descriptive name (max 50 chars)",
  "description": "Brief description (max 100 chars)",
  "recommendedChannels": ["channel1", "channel2"],
  "suggestedTiming": "When to send this",
  "tone": "professional|casual|friendly|urgent",
  "reasoning": "Why these suggestions"
}`;

    const schema: Record<string, unknown> = {
      type: "object",
      required: [
        "campaignName",
        "description",
        "recommendedChannels",
        "suggestedTiming",
        "tone",
        "reasoning",
      ],
      properties: {
        campaignName: { type: "string" },
        description: { type: "string" },
        recommendedChannels: { type: "array", items: { type: "string" } },
        suggestedTiming: { type: "string" },
        tone: { type: "string" },
        reasoning: { type: "string" },
      },
    };

    try {
      const response = await provider.complete({
        systemPrompt,
        userPrompt,
        schema,
        temperature: 0.7,
        maxTokens: 512,
      });

      return response.parsedContent as {
        campaignName: string;
        description: string;
        recommendedChannels: string[];
        suggestedTiming: string;
        tone: string;
        reasoning: string;
      };
    } catch (err) {
      console.error("[AIOrchestrationLayer] campaign suggestion failed:", err);
      return null;
    }
  }

  async complete(
    request: AICompletionRequest,
    tenantId?: string,
    providerName?: AIProviderName,
  ): Promise<AICompletionResponse | null> {
    const provider = this.registry.resolve(tenantId ?? "", providerName);
    try {
      return await provider.complete(request);
    } catch (err) {
      console.error("[AIOrchestrationLayer] completion failed:", err);
      return null;
    }
  }
}
