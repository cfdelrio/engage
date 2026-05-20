import { Anthropic } from '@anthropic-ai/sdk';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages.js';

function extractText(content: Anthropic.ContentBlock[]): string {
  const block = content.find((b): b is TextBlock => b.type === 'text');
  if (!block) throw new Error('No text block in AI response');
  return block.text;
}

export interface VoiceGenerationRequest {
  script: string;
  languageCode: string;
  voiceGender: 'male' | 'female';
  tenantId: string;
  speed?: number;
}

export interface VoiceGenerationResponse {
  audioUrl: string;
  duration: number;
  provider: string;
  model: string;
}

export interface SentimentAnalysisRequest {
  transcription: string;
  tenantId: string;
}

export interface SentimentAnalysisResponse {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  reasoning: string;
}

export class VoiceGenerator {
  private anthropic: Anthropic;

  constructor(apiKey?: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env['ANTHROPIC_API_KEY'],
    });
  }

  async analyzeSentiment(
    req: SentimentAnalysisRequest,
  ): Promise<SentimentAnalysisResponse> {
    const systemPrompt = `You are a sentiment analysis expert. Analyze the user's transcription and determine their sentiment.
Respond with a JSON object containing:
- sentiment: "positive", "neutral", or "negative"
- confidence: a number between 0 and 1
- reasoning: a brief explanation of why you classified it that way`;

    const userPrompt = `Analyze this call transcription for sentiment:\n\n${req.transcription}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-1',
        max_tokens: 200,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const parsed = JSON.parse(extractText(response.content));
      return {
        sentiment: parsed.sentiment,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
      };
    } catch (err) {
      console.error('Failed to analyze sentiment:', err);
      return {
        sentiment: 'neutral',
        confidence: 0,
        reasoning: 'Failed to analyze',
      };
    }
  }

  async generateVoiceDescription(
    req: VoiceGenerationRequest,
  ): Promise<string> {
    const userPrompt = `Generate a brief, natural description of how to say this message with appropriate pauses and emphasis for a voice call:

Script: ${req.script}
Language: ${req.languageCode}
Voice: ${req.voiceGender}
Speed: ${req.speed || 1.0}

Provide speaking instructions (e.g., "pause after first sentence", "emphasize the word X", etc.)`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-1',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      return extractText(response.content);
    } catch (err) {
      console.error('Failed to generate voice description:', err);
      return '';
    }
  }

  async generateEmotionalTone(script: string, emotion: string): Promise<string> {
    const userPrompt = `Rewrite this message with a ${emotion} emotional tone while keeping the same content:

Original: ${script}

Provide only the rewritten message, no explanation.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-1',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      return extractText(response.content);
    } catch (err) {
      console.error('Failed to generate emotional tone:', err);
      return script;
    }
  }
}

export class GoogleCloudTTSProvider {
  private projectId: string;

  constructor(projectId?: string) {
    this.projectId = projectId || process.env['GOOGLE_CLOUD_PROJECT_ID'] || '';
  }

  async synthesizeVoice(
    text: string,
    languageCode: string,
    voiceGender: 'male' | 'female',
  ): Promise<VoiceGenerationResponse> {
    try {
      // This would use @google-cloud/text-to-speech in production
      // For now, return a placeholder response
      console.log(
        `[GoogleCloudTTS] Would synthesize: "${text}" in ${languageCode}`,
      );

      return {
        audioUrl: `https://storage.googleapis.com/${this.projectId}/voice-${Date.now()}.mp3`,
        duration: Math.ceil(text.split(' ').length * 0.5),
        provider: 'google-cloud-tts',
        model: `${languageCode}-${voiceGender === 'male' ? 'Standard-B' : 'Standard-A'}`,
      };
    } catch (err) {
      console.error('Failed to synthesize voice:', err);
      throw err;
    }
  }
}

export class PollyTTSProvider {
  async synthesizeVoice(
    text: string,
    languageCode: string,
    voiceGender: 'male' | 'female',
  ): Promise<VoiceGenerationResponse> {
    try {
      // This would use aws-sdk in production
      // For now, return a placeholder response
      const voiceMap: Record<string, Record<string, string>> = {
        'es-ES': {
          male: 'Enrique',
          female: 'Lucia',
        },
        'es-MX': {
          male: 'Juan',
          female: 'Lupe',
        },
        'en-US': {
          male: 'Matthew',
          female: 'Joanna',
        },
      };

      const voice =
        voiceMap[languageCode]?.[voiceGender === 'male' ? 'male' : 'female'] ||
        'Joanna';

      console.log(
        `[PollyTTS] Would synthesize: "${text}" with voice ${voice}`,
      );

      return {
        audioUrl: `https://s3.amazonaws.com/polly-voice-${Date.now()}.mp3`,
        duration: Math.ceil(text.split(' ').length * 0.5),
        provider: 'aws-polly',
        model: voice,
      };
    } catch (err) {
      console.error('Failed to synthesize voice with Polly:', err);
      throw err;
    }
  }
}

export class ElevenLabsProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env['ELEVENLABS_API_KEY'] || '';
  }

  async synthesizeVoice(
    text: string,
    languageCode: string,
    voiceGender: 'male' | 'female',
  ): Promise<VoiceGenerationResponse> {
    try {
      // This would use elevenlabs API in production
      console.log(
        `[ElevenLabs] Would synthesize: "${text}" in ${languageCode}`,
      );

      return {
        audioUrl: `https://api.elevenlabs.io/voice-${Date.now()}.mp3`,
        duration: Math.ceil(text.split(' ').length * 0.5),
        provider: 'elevenlabs',
        model: `${languageCode}-${voiceGender === 'male' ? 'Adam' : 'Bella'}`,
      };
    } catch (err) {
      console.error('Failed to synthesize voice with ElevenLabs:', err);
      throw err;
    }
  }
}
