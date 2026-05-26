import type { FastifyPluginAsync } from "fastify";
import {
  AIProviderRegistry,
  AIOrchestrationLayer,
  AnthropicProvider,
  OpenAIProvider,
  MockAIProvider,
  RuleInterpreter,
  RuleAnalyst,
} from "@engage/ai";
import type { AIProvider } from "@engage/ai";
import type { AIProviderName } from "@engage/core";
import { decrypt } from "@engage/core";

declare module "fastify" {
  interface FastifyInstance {
    aiLayer: AIOrchestrationLayer;
    ruleInterpreter: RuleInterpreter;
    ruleAnalyst: RuleAnalyst;
    createScopedAI: (
      tenantId: string,
    ) => Promise<{
      ruleAnalyst: RuleAnalyst;
      ruleInterpreter: RuleInterpreter;
    }>;
  }
}

const aiPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize AI providers based on environment
  const aiProviders = new Map<AIProviderName, AIProvider>();

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
  const ruleInterpreter = new RuleInterpreter(aiRegistry);
  const ruleAnalyst = new RuleAnalyst(aiRegistry);

  fastify.decorate("aiLayer", aiLayer);
  fastify.decorate("ruleInterpreter", ruleInterpreter);
  fastify.decorate("ruleAnalyst", ruleAnalyst);

  // Per-tenant provider cache (5 min TTL)
  const tenantProviderCache = new Map<
    string,
    {
      provider: AIProvider;
      providerName: AIProviderName;
      expiresAt: number;
    }
  >();

  async function getTenantAIProvider(tenantId: string) {
    const cached = tenantProviderCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached;

    const encKey = process.env["PROVIDER_CONFIG_KEY"];
    if (!encKey) return undefined;

    const tenant = await fastify.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const keys = (tenant?.settings as Record<string, unknown> | null)
      ?.encryptedAiKeys as Record<string, string> | undefined;

    const providerCtors: [AIProviderName, new (key: string) => AIProvider][] = [
      ["anthropic", AnthropicProvider],
      ["openai", OpenAIProvider],
    ];

    for (const [name, Ctor] of providerCtors) {
      const encryptedKey = keys?.[name];
      if (!encryptedKey) continue;
      try {
        const apiKey = decrypt(encryptedKey, encKey);
        const provider = new Ctor(apiKey);
        const entry = {
          provider,
          providerName: name,
          expiresAt: Date.now() + 5 * 60 * 1000,
        };
        tenantProviderCache.set(tenantId, entry);
        return entry;
      } catch {
        // decryption failure → try next provider
      }
    }
    return undefined;
  }

  fastify.decorate("createScopedAI", async (tenantId: string) => {
    const tenantEntry = await getTenantAIProvider(tenantId);
    if (!tenantEntry) return { ruleAnalyst, ruleInterpreter };

    const scopedProviders = new Map(aiProviders);
    scopedProviders.set(tenantEntry.providerName, tenantEntry.provider);
    const scopedRegistry = new AIProviderRegistry({
      defaultProvider: tenantEntry.providerName,
      providers: scopedProviders,
    });
    return {
      ruleAnalyst: new RuleAnalyst(scopedRegistry),
      ruleInterpreter: new RuleInterpreter(scopedRegistry),
    };
  });

  fastify.log.info(
    `AI layer initialized with provider: ${defaultProvider}, ruleInterpreter: ${ruleInterpreter ? "ready" : "failed"}`,
  );
};

export default aiPlugin;
