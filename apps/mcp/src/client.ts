export class EngageClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "x-api-key": this.apiKey,
        "content-type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const msg =
        typeof err["error"] === "string" ? err["error"] : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return res.json() as Promise<T>;
  }
}
