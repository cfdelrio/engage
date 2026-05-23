import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrkestaiVoiceClient } from "../client";

describe("OrkestaiVoiceClient", () => {
  let client: OrkestaiVoiceClient;

  beforeEach(() => {
    client = new OrkestaiVoiceClient(
      "https://api.example.com",
      "ok_test_key",
      "tenant_123",
    );
    vi.resetAllMocks();
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

  it("should send Authorization header with api key", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          contact: { id: "c1", firstName: "Ana", phone: "+1234" },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await client.createContact("Ana", "+1234");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer ok_test_key",
    );
  });

  it("should throw on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: "Not found" } }),
      }),
    );

    await expect(client.getContact("missing")).rejects.toThrow("Not found");
  });
});
