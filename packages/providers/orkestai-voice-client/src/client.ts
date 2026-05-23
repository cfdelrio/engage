import type {
  Contact,
  Campaign,
  VoiceFlow,
  FlowStep,
  CampaignResults,
  AddRecipientsResponse,
  CreateCampaignResponse,
  CreateContactResponse,
  CreateFlowResponse,
  StartCampaignResponse,
} from "./types.js";

export class OrkestaiVoiceClient {
  private baseUrl: string;
  private apiKey: string;
  private tenantId: string;

  constructor(apiUrl: string, apiKey: string, tenantId: string) {
    this.baseUrl = apiUrl;
    this.apiKey = apiKey;
    this.tenantId = tenantId;
  }

  async createContact(
    firstName: string,
    phone: string,
    lastName?: string,
    email?: string,
    metadata?: Record<string, unknown>,
  ): Promise<Contact> {
    const response = await this._request<CreateContactResponse>(
      "POST",
      `/api/tenants/${this.tenantId}/contacts`,
      { firstName, lastName, phone, email, metadata },
    );
    return response.contact;
  }

  async getContact(contactId: string): Promise<Contact> {
    const response = await this._request<{ contact: Contact }>(
      "GET",
      `/api/tenants/${this.tenantId}/contacts/${contactId}`,
    );
    return response.contact;
  }

  async createCampaign(
    name: string,
    ttsProvider: "elevenlabs" | "openai",
    elevenLabsVoiceId?: string,
    voiceInstructions?: string,
    description?: string,
  ): Promise<Campaign> {
    const response = await this._request<CreateCampaignResponse>(
      "POST",
      `/api/tenants/${this.tenantId}/campaigns`,
      {
        name,
        description,
        ttsProvider,
        elevenLabsVoiceId,
        voiceInstructions,
      },
    );
    return response.campaign;
  }

  async getCampaign(campaignId: string): Promise<Campaign> {
    const response = await this._request<{ campaign: Campaign }>(
      "GET",
      `/api/campaigns/${campaignId}`,
    );
    return response.campaign;
  }

  async defineCampaignFlow(
    campaignId: string,
    steps: FlowStep[],
  ): Promise<VoiceFlow> {
    const response = await this._request<CreateFlowResponse>(
      "POST",
      `/api/campaigns/${campaignId}/flow`,
      { steps },
    );
    return response.flow;
  }

  async addRecipients(
    campaignId: string,
    contactIds: string[],
  ): Promise<AddRecipientsResponse> {
    const response = await this._request<AddRecipientsResponse>(
      "POST",
      `/api/campaigns/${campaignId}/recipients`,
      { contactIds },
    );
    return response;
  }

  async startCampaign(campaignId: string): Promise<StartCampaignResponse> {
    const response = await this._request<StartCampaignResponse>(
      "POST",
      `/api/campaigns/${campaignId}/start`,
    );
    return response;
  }

  async pauseCampaign(campaignId: string): Promise<void> {
    await this._request("PATCH", `/api/campaigns/${campaignId}/pause`);
  }

  async resumeCampaign(campaignId: string): Promise<void> {
    await this._request("PATCH", `/api/campaigns/${campaignId}/resume`);
  }

  async getCampaignResults(campaignId: string): Promise<CampaignResults> {
    const response = await this._request<CampaignResults>(
      "GET",
      `/api/campaigns/${campaignId}/results`,
    );
    return response;
  }

  private async _request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    data?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      ...(data !== undefined && { body: JSON.stringify(data) }),
    });
    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as {
        error?: { message: string; detail?: string };
      } | null;
      const message =
        errorData?.error?.message ?? "Unknown error from orkestai-voice";
      const detail = errorData?.error?.detail
        ? ` — ${errorData.error.detail}`
        : "";
      throw new Error(`${message}${detail}`);
    }
    return (await response.json()) as T;
  }
}
