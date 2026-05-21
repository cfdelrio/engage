import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@engage/database";
import { EngagementScorer } from "./engagement-scorer.js";

type DeliveryRow = {
  sentAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
};

const makeDelivery = (
  sent: boolean,
  opened: boolean,
  clicked = false,
): DeliveryRow => ({
  sentAt: sent ? new Date() : null,
  openedAt: opened ? new Date() : null,
  clickedAt: clicked ? new Date() : null,
});

describe("EngagementScorer.recalculate", () => {
  let mockDb: {
    delivery: { findMany: ReturnType<typeof vi.fn> };
    userEngagementScore: { upsert: ReturnType<typeof vi.fn> };
  };
  let scorer: EngagementScorer;
  const userId = "user-1";
  const tenantId = "tenant-1";

  beforeEach(() => {
    mockDb = {
      delivery: { findMany: vi.fn() },
      userEngagementScore: { upsert: vi.fn().mockResolvedValue({}) },
    };
    scorer = new EngagementScorer();
  });

  it("computes openRate30d = opened / sent for 30 day window", async () => {
    // 4 sent, 2 opened, 0 clicked → openRate = 0.5
    mockDb.delivery.findMany
      .mockResolvedValueOnce([
        makeDelivery(true, true),
        makeDelivery(true, true),
        makeDelivery(true, false),
        makeDelivery(true, false),
      ])
      .mockResolvedValueOnce([]);

    await scorer.recalculate(
      userId,
      tenantId,
      mockDb as unknown as PrismaClient,
    );

    expect(mockDb.userEngagementScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          openRate30d: expect.closeTo(0.5, 5),
        }),
        create: expect.objectContaining({
          openRate30d: expect.closeTo(0.5, 5),
        }),
      }),
    );
  });

  it("computes clickRate30d = clicked / sent for 30 day window", async () => {
    // 4 sent, 0 opened, 1 clicked → clickRate = 0.25
    mockDb.delivery.findMany
      .mockResolvedValueOnce([
        makeDelivery(true, false, true),
        makeDelivery(true, false),
        makeDelivery(true, false),
        makeDelivery(true, false),
      ])
      .mockResolvedValueOnce([]);

    await scorer.recalculate(
      userId,
      tenantId,
      mockDb as unknown as PrismaClient,
    );

    expect(mockDb.userEngagementScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          clickRate30d: expect.closeTo(0.25, 5),
        }),
        create: expect.objectContaining({
          clickRate30d: expect.closeTo(0.25, 5),
        }),
      }),
    );
  });

  it("engagementScore = min(1, openRate * 0.6 + clickRate * 0.4)", async () => {
    // openRate=1, clickRate=1 → score = 1.0
    mockDb.delivery.findMany
      .mockResolvedValueOnce([
        makeDelivery(true, true, true),
        makeDelivery(true, true, true),
      ])
      .mockResolvedValueOnce([]);

    await scorer.recalculate(
      userId,
      tenantId,
      mockDb as unknown as PrismaClient,
    );

    expect(mockDb.userEngagementScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ score: expect.closeTo(1, 5) }),
      }),
    );
  });

  it("engagementScore is capped at 1", async () => {
    mockDb.delivery.findMany
      .mockResolvedValueOnce([makeDelivery(true, true, true)])
      .mockResolvedValueOnce([]);

    await scorer.recalculate(
      userId,
      tenantId,
      mockDb as unknown as PrismaClient,
    );

    expect(mockDb.userEngagementScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ score: expect.closeTo(1, 5) }),
      }),
    );
  });

  it("fatigueScore = 1 when high volume + zero engagement in 7 days", async () => {
    const twenty = Array.from({ length: 20 }, () => makeDelivery(true, false));
    mockDb.delivery.findMany
      .mockResolvedValueOnce(twenty)
      .mockResolvedValueOnce(twenty);

    await scorer.recalculate(
      userId,
      tenantId,
      mockDb as unknown as PrismaClient,
    );

    expect(mockDb.userEngagementScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ fatigueScore: expect.closeTo(1, 5) }),
        create: expect.objectContaining({ fatigueScore: expect.closeTo(1, 5) }),
      }),
    );
  });

  it("fatigueScore = 0 when no deliveries in 7 days", async () => {
    mockDb.delivery.findMany
      .mockResolvedValueOnce([makeDelivery(true, true)])
      .mockResolvedValueOnce([]);

    await scorer.recalculate(
      userId,
      tenantId,
      mockDb as unknown as PrismaClient,
    );

    expect(mockDb.userEngagementScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ fatigueScore: expect.closeTo(0, 5) }),
        create: expect.objectContaining({ fatigueScore: expect.closeTo(0, 5) }),
      }),
    );
  });

  it("calls upsert with correct where, create, and update structure", async () => {
    mockDb.delivery.findMany
      .mockResolvedValueOnce([
        makeDelivery(true, true, true),
        makeDelivery(true, false),
      ])
      .mockResolvedValueOnce([
        makeDelivery(true, true),
        makeDelivery(true, false),
      ]);

    await scorer.recalculate(
      userId,
      tenantId,
      mockDb as unknown as PrismaClient,
    );

    expect(mockDb.userEngagementScore.upsert).toHaveBeenCalledOnce();
    expect(mockDb.userEngagementScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
        create: expect.objectContaining({ userId, tenantId }),
        update: expect.objectContaining({
          score: expect.any(Number),
          fatigueScore: expect.any(Number),
          openRate30d: expect.any(Number),
          clickRate30d: expect.any(Number),
          lastCalculatedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("handles zero sent deliveries without division by zero", async () => {
    mockDb.delivery.findMany
      .mockResolvedValueOnce([
        { sentAt: null, openedAt: new Date(), clickedAt: new Date() },
        { sentAt: null, openedAt: null, clickedAt: null },
      ])
      .mockResolvedValueOnce([
        { sentAt: null, openedAt: new Date(), clickedAt: null },
      ]);

    await scorer.recalculate(
      userId,
      tenantId,
      mockDb as unknown as PrismaClient,
    );

    expect(mockDb.userEngagementScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          openRate30d: 0,
          clickRate30d: 0,
          score: 0,
          fatigueScore: 0,
        }),
      }),
    );
  });
});
