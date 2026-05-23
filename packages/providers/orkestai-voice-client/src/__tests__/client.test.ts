import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { OrkestaiVoiceClient } from "../client";

vi.mock("axios");

describe("OrkestaiVoiceClient", () => {
  let client: OrkestaiVoiceClient;
  const mockAxios = axios as unknown as { create: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const mockInstance = {
      request: vi.fn(),
    };
    vi.mocked(mockAxios.create).mockReturnValue(
      mockInstance as Record<string, unknown>,
    );
    client = new OrkestaiVoiceClient(
      "https://api.example.com",
      "ok_test_key",
      "tenant_123",
    );
  });

  it("should instantiate with correct credentials", () => {
    expect(client).toBeDefined();
  });

  it("should have all required methods", () => {
    expect(typeof client.createContact).toBe("function");
    expect(typeof client.createCampaign).toBe("function");
    expect(typeof client.defineCampaignFlow).toBe("function");
    expect(typeof client.addRecipients).toBe("function");
    expect(typeof client.startCampaign).toBe("function");
  });
});
