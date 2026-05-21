import { describe, it, expect, beforeEach } from "vitest";
import { AIProviderRegistry } from "./provider-registry.js";
import { MockAIProvider } from "./providers/mock.js";
import type { AIProviderName } from "@engage/core";

describe("AIProviderRegistry", () => {
  let mockProvider: MockAIProvider;
  let anotherMockProvider: MockAIProvider;

  beforeEach(() => {
    mockProvider = new MockAIProvider();
    anotherMockProvider = new MockAIProvider();
  });

  it("resolves default provider when no overrides exist", () => {
    const registry = new AIProviderRegistry({
      defaultProvider: "mock",
      providers: new Map<AIProviderName, MockAIProvider>([
        ["mock", mockProvider],
      ]),
    });

    const resolved = registry.resolve("tenant-1");
    expect(resolved).toBe(mockProvider);
  });

  it("resolves tenant-specific override when set", () => {
    const registry = new AIProviderRegistry({
      defaultProvider: "mock",
      providers: new Map<AIProviderName, MockAIProvider>([
        ["mock", mockProvider],
        ["openai", anotherMockProvider],
      ]),
      tenantOverrides: new Map([["tenant-1", "openai" as AIProviderName]]),
    });

    const resolved = registry.resolve("tenant-1");
    expect(resolved).toBe(anotherMockProvider);
  });

  it("falls back to default when tenant override is unknown provider", () => {
    const registry = new AIProviderRegistry({
      defaultProvider: "mock",
      providers: new Map<AIProviderName, MockAIProvider>([
        ["mock", mockProvider],
      ]),
      tenantOverrides: new Map([["tenant-1", "openai" as AIProviderName]]),
    });

    // 'openai' is in tenantOverrides but not registered in providers — should fall back
    const resolved = registry.resolve("tenant-1");
    expect(resolved).toBe(mockProvider);
  });

  it("falls back to default when explicit provider name is unknown", () => {
    const registry = new AIProviderRegistry({
      defaultProvider: "mock",
      providers: new Map<AIProviderName, MockAIProvider>([
        ["mock", mockProvider],
      ]),
    });

    // 'anthropic' is not registered in providers
    const resolved = registry.resolve(
      "tenant-1",
      "anthropic" as AIProviderName,
    );
    expect(resolved).toBe(mockProvider);
  });

  it("resolves in correct priority order: tenantConfigProvider > tenantOverride > default", () => {
    const tenantConfigProvider = new MockAIProvider();
    const tenantOverrideProvider = new MockAIProvider();

    const registry = new AIProviderRegistry({
      defaultProvider: "mock",
      providers: new Map<AIProviderName, MockAIProvider>([
        ["mock", mockProvider],
        ["openai", tenantOverrideProvider],
        ["anthropic", tenantConfigProvider],
      ]),
      tenantOverrides: new Map([["tenant-1", "openai" as AIProviderName]]),
    });

    // tenantConfigProvider ('anthropic') should win over tenantOverride ('openai') and default ('mock')
    const resolved = registry.resolve(
      "tenant-1",
      "anthropic" as AIProviderName,
    );
    expect(resolved).toBe(tenantConfigProvider);
  });

  it("register() adds a new provider that can be resolved", () => {
    const registry = new AIProviderRegistry({
      defaultProvider: "mock",
      providers: new Map<AIProviderName, MockAIProvider>([
        ["mock", mockProvider],
      ]),
    });

    const newProvider = new MockAIProvider();
    registry.register("anthropic", newProvider);

    const resolved = registry.resolve("tenant-1", "anthropic");
    expect(resolved).toBe(newProvider);
  });

  it("setTenantOverride() and clearTenantOverride() work correctly", () => {
    const registry = new AIProviderRegistry({
      defaultProvider: "mock",
      providers: new Map<AIProviderName, MockAIProvider>([
        ["mock", mockProvider],
        ["openai", anotherMockProvider],
      ]),
    });

    // Before override: resolves default
    expect(registry.resolve("tenant-1")).toBe(mockProvider);

    // After setTenantOverride: resolves override
    registry.setTenantOverride("tenant-1", "openai");
    expect(registry.resolve("tenant-1")).toBe(anotherMockProvider);

    // After clearTenantOverride: back to default
    registry.clearTenantOverride("tenant-1");
    expect(registry.resolve("tenant-1")).toBe(mockProvider);
  });

  it("throws when no default provider is available", () => {
    const registry = new AIProviderRegistry({
      defaultProvider: "mock",
      providers: new Map(), // no providers registered at all
    });

    expect(() => registry.resolve("tenant-1")).toThrow(
      "No AI provider available",
    );
  });
});
