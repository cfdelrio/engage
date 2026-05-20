import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AICompletionRequest, AICompletionResponse } from '../provider.interface.js';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-6') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    // cache_control is supported via prompt caching API but type definitions may vary by SDK version
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const systemContent: any = request.cacheControl
      ? [{ type: 'text', text: request.systemPrompt, cache_control: { type: 'ephemeral' } }]
      : request.systemPrompt;

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature ?? 0.3,
      system: systemContent,
      messages: [{ role: 'user', content: request.userPrompt }],
    });

    const content = message.content[0]?.type === 'text' ? message.content[0].text : '';

    let parsedContent: unknown;
    if (request.schema && content) {
      try {
        parsedContent = JSON.parse(content);
      } catch {
        // content is not JSON — return as string
      }
    }

    const usageRaw = message.usage as unknown as Record<string, number>;
    const cachedTokens = usageRaw['cache_read_input_tokens'];

    const usage: AICompletionResponse['usage'] = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
    if (cachedTokens !== undefined) {
      usage.cachedTokens = cachedTokens;
    }

    return { content, parsedContent, usage, model: this.model, provider: this.name };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple check: create a minimal message
      await this.client.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
