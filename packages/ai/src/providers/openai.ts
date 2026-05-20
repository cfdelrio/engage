import OpenAI from 'openai';
import type { AIProvider, AICompletionRequest, AICompletionResponse } from '../provider.interface.js';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 1024,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      ...(request.schema
        ? {
            response_format: { type: 'json_object' },
          }
        : {}),
    });

    const content = response.choices[0]?.message?.content ?? '';

    let parsedContent: unknown;
    if (request.schema && content) {
      try {
        parsedContent = JSON.parse(content);
      } catch {
        // not JSON
      }
    }

    return {
      content,
      parsedContent,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
      model: this.model,
      provider: this.name,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
