import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Redis } from "ioredis";
import { REDIS_KEYS } from "@engage/core";
import { isDuplicate } from "./dedup.js";

function makeMockRedis() {
  return { set: vi.fn() } as unknown as Redis;
}

describe("isDuplicate", () => {
  let mockRedis: Redis;

  beforeEach(() => {
    mockRedis = makeMockRedis();
  });

  it('returns false when key does not exist (SET NX returns "OK")', async () => {
    vi.mocked(mockRedis.set).mockResolvedValue("OK");
    expect(await isDuplicate(mockRedis, "key-abc")).toBe(false);
  });

  it('returns false when key does not exist (SET NX returns "1")', async () => {
    vi.mocked(mockRedis.set).mockResolvedValue("1" as never);
    expect(await isDuplicate(mockRedis, "key-abc")).toBe(false);
  });

  it("returns true when key already exists (SET NX returns null)", async () => {
    vi.mocked(mockRedis.set).mockResolvedValue(null as never);
    expect(await isDuplicate(mockRedis, "key-abc")).toBe(true);
  });

  it("uses the correct Redis key format from REDIS_KEYS.eventDedup", async () => {
    const key = "my-event-123";
    vi.mocked(mockRedis.set).mockResolvedValue("OK");
    await isDuplicate(mockRedis, key);
    expect(vi.mocked(mockRedis.set)).toHaveBeenCalledWith(
      REDIS_KEYS.eventDedup(key),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("sets TTL of 86400 seconds with EX and NX flags", async () => {
    vi.mocked(mockRedis.set).mockResolvedValue("OK");
    await isDuplicate(mockRedis, "key-ttl");
    expect(vi.mocked(mockRedis.set)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "EX",
      86400,
      "NX",
    );
  });

  it("different idempotency keys are tracked independently", async () => {
    vi.mocked(mockRedis.set)
      .mockResolvedValueOnce(null as never) // first key exists
      .mockResolvedValueOnce("OK"); // second key new

    expect(await isDuplicate(mockRedis, "key-first")).toBe(true);
    expect(await isDuplicate(mockRedis, "key-second")).toBe(false);

    const calls = vi.mocked(mockRedis.set).mock.calls;
    expect(calls[0]?.[0]).toBe(REDIS_KEYS.eventDedup("key-first"));
    expect(calls[1]?.[0]).toBe(REDIS_KEYS.eventDedup("key-second"));
    expect(calls[0]?.[0]).not.toBe(calls[1]?.[0]);
  });
});
