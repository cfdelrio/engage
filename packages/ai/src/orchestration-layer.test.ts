import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIOrchestrationLayer } from "./orchestration-layer.js";
import { AIProviderRegistry } from "./provider-registry.js";
import { MockAIProvider } from "./providers/mock.js";
import type { EventContext } from "@engage/core";
import type { AIProviderName } from "@engage/core";

function makeRegistry(provider: MockAIProvider): AIProviderRegistry {
  return new AIProviderRegistry({
    defaultProvider: "mock" as AIProviderName,
    providers: new Map<AIProviderName, MockAIProvider>([["mock", provider]]),
  });
}

const baseCtx: EventContext = {
  event: {
    id: "e1",
    tenantId: "t1",
    type: "prode.ranking.changed",
    userId: "u1",
    payload: { newRank: 1 },
    metadata: {},
    receivedAt: new Date(),
  },
  user: {
    id: "u1",
    externalId: "ext1",
    timezone: "UTC",
    locale: "en",
    fatigueScore: 0.2,
    engagementScore: 0.8,
    metadata: {},
    isActiveSession: true,
    tags: [],
  },
  tenant: { id: "t1", slug: "test", settings: {} },
};

describe("AIOrchestrationLayer", () => {
  let mockProvider: MockAIProvider;
  let registry: AIProviderRegistry;
  let orchestrator: AIOrchestrationLayer;

  beforeEach(() => {
    mockProvider = new MockAIProvider();
    registry = makeRegistry(mockProvider);
    orchestrator = new AIOrchestrationLayer(registry);
  });

  it("consultForDecision returns a valid AIDecision with shouldEngage, channel, channelConfidence, copyVariants", async () => {
    const completeSpy = vi.spyOn(mockProvider, "complete");

    const decision = await orchestrator.consultForDecision(baseCtx);

    expect(completeSpy).toHaveBeenCalledOnce();
    expect(decision).not.toBeNull();
    expect(decision).toMatchObject({
      shouldEngage: expect.any(Boolean),
      channel: expect.any(String),
      channelConfidence: expect.any(Number),
      copyVariants: expect.any(Array),
    });
    expect(
      Array.isArray(decision?.copyVariants) && decision.copyVariants.length > 0,
    ).toBe(true);
  });

  it("consultForDecision returns null when provider throws (non-fatal)", async () => {
    vi.spyOn(mockProvider, "complete").mockRejectedValueOnce(
      new Error("API unavailable"),
    );

    const decision = await orchestrator.consultForDecision(baseCtx);

    expect(decision).toBeNull();
  });

  it("consultForDecision returns null when parsedContent is missing", async () => {
    vi.spyOn(mockProvider, "complete").mockResolvedValueOnce({
      content: "{}",
      parsedContent: undefined,
      usage: { inputTokens: 0, outputTokens: 0 },
      model: "mock-model",
      provider: "mock",
    });

    const decision = await orchestrator.consultForDecision(baseCtx);

    expect(decision).toBeNull();
  });

  it("AI decision respects context: high fatigue user still gets a decision (guardrails are upstream)", async () => {
    const highFatigueCtx: EventContext = {
      ...baseCtx,
      user: {
        ...baseCtx.user,
        fatigueScore: 0.95,
        engagementScore: 0.1,
      },
    };

    const completeSpy = vi.spyOn(mockProvider, "complete");

    const decision = await orchestrator.consultForDecision(highFatigueCtx);

    // The orchestration layer itself does not suppress based on fatigue —
    // guardrails live upstream. It should still return a decision.
    expect(completeSpy).toHaveBeenCalledOnce();
    expect(decision).not.toBeNull();
    expect(decision).toHaveProperty("shouldEngage");

    // Verify the prompt included the high fatigue score
    expect(completeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("0.95"),
      }),
    );
  });
});
