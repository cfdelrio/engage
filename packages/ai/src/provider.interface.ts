export interface AICompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  schema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  cacheControl?: boolean;
}

export interface AICompletionResponse {
  content: string;
  parsedContent?: unknown;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
  };
  model: string;
  provider: string;
}

export interface AIProvider {
  readonly name: string;
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
  isAvailable(): Promise<boolean>;
}
