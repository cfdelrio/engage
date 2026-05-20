import type { AIProvider, AICompletionRequest, AICompletionResponse } from '../provider.interface.js';

export class MockAIProvider implements AIProvider {
  readonly name = 'mock';
  private responses: Map<string, unknown>;

  constructor(responses: Map<string, unknown> = new Map()) {
    this.responses = responses;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const key = request.userPrompt.slice(0, 50);
    const mockContent = this.responses.get(key) ?? {
      shouldEngage: true,
      channel: 'push',
      channelConfidence: 0.85,
      schedulingOffsetMinutes: 0,
      copyVariants: [
        { id: 'v1', body: 'Mock notification body', tone: 'neutral', confidence: 0.9 },
      ],
      reasoning: 'Mock AI decision',
      estimatedFatigueImpact: 0.1,
    };

    const content = JSON.stringify(mockContent);
    return {
      content,
      parsedContent: mockContent,
      usage: { inputTokens: 0, outputTokens: 0 },
      model: 'mock-model',
      provider: this.name,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
