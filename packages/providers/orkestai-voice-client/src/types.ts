export interface Contact {
  id: string;
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FlowStep {
  id: string;
  type: "say" | "dtmf_question" | "speech_question" | "goodbye";
  text: string;
  options?: Record<string, string>;
  timeout?: number;
}

export interface VoiceFlow {
  id: string;
  campaignId: string;
  steps: FlowStep[];
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: "draft" | "running" | "paused" | "completed";
  ttsProvider: "elevenlabs" | "openai";
  elevenLabsVoiceId?: string;
  voiceInstructions?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceResponse {
  stepId: string;
  input: string;
  value: string;
  createdAt: string;
}

export interface VoiceCall {
  callId: string;
  campaignId: string;
  recipientId: string;
  status: "pending" | "answered" | "completed" | "failed" | "no_answer";
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  responses: VoiceResponse[];
}

export interface CampaignStats {
  totalRecipients: number;
  recipientsByStatus: {
    pending: number;
    called: number;
    failed: number;
  };
  callsByStatus: {
    answered: number;
    no_answer: number;
    completed: number;
  };
  responsesByStep: Record<string, Record<string, number>>;
}

export interface CampaignResults {
  campaign: Campaign;
  stats: CampaignStats;
  recipients: Array<{
    id: string;
    firstName: string;
    phone: string;
    status: string;
    lastCall?: VoiceCall;
    responses?: VoiceResponse[];
  }>;
}

export interface CampaignListResponse {
  campaigns: Campaign[];
}

export interface AddRecipientsResponse {
  added: number;
  skipped: number;
}

export interface CreateCampaignResponse {
  campaign: Campaign;
}

export interface CreateContactResponse {
  contact: Contact;
}

export interface CreateFlowResponse {
  flow: VoiceFlow;
}

export interface StartCampaignResponse {
  campaignId: string;
  status: "running";
  enqueued: number;
}

export interface ApiError {
  error: {
    message: string;
    detail?: string;
  };
}

export interface WebhookPayload {
  event:
    | "call.answered"
    | "call.completed"
    | "call.failed"
    | "call.no_answer"
    | "campaign.completed";
  timestamp: string;
  tenantId: string;
  data: Record<string, unknown>;
}

export interface CallCompletedWebhookData {
  callId: string;
  campaignId: string;
  recipientId: string;
  status: "completed";
  startedAt: string;
  endedAt: string;
  duration: number;
  responses: VoiceResponse[];
}

export interface CampaignCompletedWebhookData {
  campaignId: string;
  campaignName: string;
  completedAt: string;
}
