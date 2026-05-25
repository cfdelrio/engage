import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../src/app.js";
import { prisma } from "@engage/database";
import type { FastifyInstance } from "fastify";
import { generateApiKey, hashApiKey } from "@engage/core";

const skipIfNoDatabaseUrl = !process.env.DATABASE_URL
  ? describe.skip
  : describe;

skipIfNoDatabaseUrl("POST /v1/users/bulk", () => {
  let app: FastifyInstance;
  let tenantId: string;
  let apiKey: string;
  let setupFailed = false;

  beforeAll(async () => {
    try {
      app = await buildApp();

      const tenant = await prisma.tenant.create({
        data: {
          slug: `test-bulk-${Date.now()}`,
          name: "Test Bulk Tenant",
          plan: "starter",
        },
      });
      tenantId = tenant.id;

      const { raw } = generateApiKey();
      apiKey = raw;
      await prisma.tenantApiKey.create({
        data: {
          tenantId,
          name: "Bulk Test Key",
          keyHash: hashApiKey(raw),
          keyPrefix: raw.slice(0, 10),
          permissions: JSON.stringify(["users:write"]),
          status: "active",
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        setupFailed = true;
        console.warn(
          "[users.bulk.test] Skipping: DB tables not initialized. Run: pnpm --filter @engage/database db:push",
        );
        return;
      }
      throw error;
    }
  });

  afterAll(async () => {
    if (app) await app.close();
    if (!tenantId || setupFailed) return;
    try {
      await prisma.user.deleteMany({ where: { tenantId } });
      await prisma.tenantApiKey.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    } catch {
      // best-effort cleanup
    }
  });

  it("creates 3 new users", async () => {
    if (setupFailed) return;

    const res = await app.inject({
      method: "POST",
      url: "/v1/users/bulk",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        users: [
          {
            externalId: "bulk_001",
            email: "a@test.com",
            phone: "+5491155550001",
            locale: "es",
            timezone: "America/Argentina/Buenos_Aires",
          },
          { externalId: "bulk_002", email: "b@test.com", tags: ["admin"] },
          { externalId: "bulk_003", metadata: { plan: "pro" } },
        ],
      }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ total: 3, created: 3, updated: 0, failed: 0 });
    expect(body.errors).toBeUndefined();
  });

  it("updates the same 3 users on repeat (idempotent)", async () => {
    if (setupFailed) return;

    const res = await app.inject({
      method: "POST",
      url: "/v1/users/bulk",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        users: [
          {
            externalId: "bulk_001",
            email: "a@test.com",
            phone: "+5491155550001",
            locale: "es",
            timezone: "America/Argentina/Buenos_Aires",
          },
          { externalId: "bulk_002", email: "b@test.com", tags: ["admin"] },
          { externalId: "bulk_003", metadata: { plan: "pro" } },
        ],
      }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ total: 3, created: 0, updated: 3, failed: 0 });
  });

  it("rejects array of 501 users with 400", async () => {
    if (setupFailed) return;

    const users = Array.from({ length: 501 }, (_, i) => ({
      externalId: `overflow_${i}`,
    }));

    const res = await app.inject({
      method: "POST",
      url: "/v1/users/bulk",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ users }),
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects empty array with 400", async () => {
    if (setupFailed) return;

    const res = await app.inject({
      method: "POST",
      url: "/v1/users/bulk",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ users: [] }),
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects request without x-api-key with 401", async () => {
    if (setupFailed) return;

    const res = await app.inject({
      method: "POST",
      url: "/v1/users/bulk",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ users: [{ externalId: "no_auth" }] }),
    });

    expect(res.statusCode).toBe(401);
  });

  it("accepts user with email null without breaking", async () => {
    if (setupFailed) return;

    const res = await app.inject({
      method: "POST",
      url: "/v1/users/bulk",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        users: [
          {
            externalId: "bulk_null_email",
            email: null,
            phone: "+5491199990001",
          },
        ],
      }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.failed).toBe(0);
    expect(body.created).toBe(1);
  });

  it("upserts duplicate externalId within the same batch (last write wins)", async () => {
    if (setupFailed) return;

    const res = await app.inject({
      method: "POST",
      url: "/v1/users/bulk",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        users: [
          { externalId: "bulk_dup", email: "first@test.com" },
          { externalId: "bulk_dup", email: "second@test.com" },
        ],
      }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.total).toBe(2);
    expect(body.failed).toBe(0);

    const user = await prisma.user.findUnique({
      where: { tenantId_externalId: { tenantId, externalId: "bulk_dup" } },
    });
    expect(user?.email).toBe("second@test.com");
  });
});
