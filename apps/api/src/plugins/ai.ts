import type { FastifyPluginAsync } from "fastify";
import {
  AIProviderRegistry,
  AIOrchestrationLayer,
  AnthropicProvider,
  OpenAIProvider,
  MockAIProvider,
} from "@engage/ai";
import type { AIProviderName } from "@engage/core";

declare global {
  namespace FastifyInstance {
    interface FastifyInstance {
      aiLayer: AIOrchestrationLayer;
    }
  }
}

const aiPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize AI providers based on environment
  const aiProviders = new Map();

  if (process.env["ANTHROPIC_API_KEY"]) {
    aiProviders.set(
      "anthropic",
      new AnthropicProvider(process.env["ANTHROPIC_API_KEY"]),
    );
  }
  if (process.env["OPENAI_API_KEY"]) {
    aiProviders.set(
      "openai",
      new OpenAIProvider(process.env["OPENAI_API_KEY"]),
    );
  }
  aiProviders.set("mock", new MockAIProvider());

  // Determine default provider
  const defaultProvider: AIProviderName =
    (process.env["AI_DEFAULT_PROVIDER"] as AIProviderName | undefined) ??
    (process.env["ANTHROPIC_API_KEY"]
      ? "anthropic"
      : process.env["OPENAI_API_KEY"]
        ? "openai"
        : "mock");

  const aiRegistry = new AIProviderRegistry({
    defaultProvider,
    providers: aiProviders,
  });

  const aiLayer = new AIOrchestrationLayer(aiRegistry);

  fastify.decorate("aiLayer", aiLayer);

  fastify.log.info(`AI layer initialized with provider: ${defaultProvider}`);
};

export default aiPlugin;
