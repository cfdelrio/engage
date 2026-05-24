import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@engage/database";
import { EngagementScorer } from "./engagement-scorer.js";

type DeliveryRow = {
  sentAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  deliveredAt?: Date | null;
};

const makeDelivery = (
  sent: boolean,
  opened: boolean,
  clicked = false,
): DeliveryRow => ({
  sentAt: sent ? new Date() : null,
  openedAt: opened ? new Date() : null,
  clickedAt: clicked ? new Date() : null,
  deliveredAt: sent ? new Date() : null,
});

describe("EngagementScorer.recalculate", () => {
  let mockDb: {
    delivery: { findMany: ReturnType<typeof vi.fn> };
    whatsAppMessage: { findMany: ReturnType<typeof vi.fn> };
    voiceCall: { findMany: ReturnType<typeof vi.fn> };
    userEngagementScore: { upsert: ReturnType<typeof vi.fn> };
  };
  let scorer: EngagementScorer;
  const userId = "user-1";
  const tenantId = "tenant-1";

  beforeEach(() => {
    mockDb = {
      delivery: { findMany: vi.fn() },
      // Default empty — tests override per-call via mockResolvedValueOnce
      whatsAppMessage: { findMany: vi.fn().mockResolvedValue([]) },
      voiceCall: { findMany: vi.fn().mockResolvedValue([]) },
      userEngagementScore: { upsert: vi.fn().mockResolvedValue({}) },
    };
    scorer = new EngagementScorer();
  });

  // delivery.findMany is called 4 times: email30d, sms30d, push30d, all7d
  function mockDeliverySequence(
    email30d: DeliveryRow[],
    sevenDay: DeliveryRow[],
    sms30d: DeliveryRow[] = [],
    push30d: DeliveryRow[] = [],
  ) {
    mockDb.delivery.findMany
      .mockResolvedValueOnce(email30d) // 1st: email 30d
      .mockResolvedValueOnce(sms30d) //  2nd: sms 30d
      .mockResolvedValueOnce(push30d) // 3rd: push 30d
      .mockResolvedValueOnce(sevenDay); // 4th: all channels 7d
  }

  it("computes openRate30d = opened / sent for 30 day window", async () => {
    // 4 email sent, 2 opened → global openRate = 0.5
    mockDeliverySequence(
      [
        makeDelivery(true, true),
        makeDelivery(true, true),
        makeDelivery(true, false),
        makeDelivery(true, false),
      ],
      [],
    );

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
    // 4 email sent, 0 opened, 1 clicked → clickRate = 0.25
    mockDeliverySequence(
      [
        makeDelivery(true, false, true),
        makeDelivery(true, false),
        makeDelivery(true, false),
        makeDelivery(true, false),
      ],
      [],
    );

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
    mockDeliverySequence(
      [makeDelivery(true, true, true), makeDelivery(true, true, true)],
      [],
    );

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
    mockDeliverySequence([makeDelivery(true, true, true)], []);

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
    // email30d = twenty, sms30d = [], push30d = [], 7d = twenty (high volume, no opens)
    mockDeliverySequence(twenty, twenty);

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
    mockDeliverySequence([makeDelivery(true, true)], []);

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
    mockDeliverySequence(
      [makeDelivery(true, true, true), makeDelivery(true, false)],
      [makeDelivery(true, true), makeDelivery(true, false)],
    );

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
          emailOpenRate30d: expect.any(Number),
          emailClickRate30d: expect.any(Number),
          whatsappReadRate30d: expect.any(Number),
          smsDeliveryRate30d: expect.any(Number),
          voiceAnswerRate30d: expect.any(Number),
          pushOpenRate30d: expect.any(Number),
          lastCalculatedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("handles zero sent deliveries without division by zero", async () => {
    mockDeliverySequence(
      [
        { sentAt: null, openedAt: new Date(), clickedAt: new Date() },
        { sentAt: null, openedAt: null, clickedAt: null },
      ],
      [{ sentAt: null, openedAt: new Date(), clickedAt: null }],
    );

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

  it("sets preferredChannel to whatsapp when read rate exceeds email open rate", async () => {
    // 3 email sent, 1 opened (33%) vs 3 WhatsApp sent, 3 read (100%)
    mockDeliverySequence(
      [
        makeDelivery(true, true),
        makeDelivery(true, false),
        makeDelivery(true, false),
      ],
      [],
    );
    mockDb.whatsAppMessage.findMany.mockResolvedValueOnce([
      { sentAt: new Date(), readAt: new Date() },
      { sentAt: new Date(), readAt: new Date() },
      { sentAt: new Date(), readAt: new Date() },
    ]);

    await scorer.recalculate(
      userId,
      tenantId,
      mockDb as unknown as PrismaClient,
    );

    expect(mockDb.userEngagementScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          whatsappReadRate30d: expect.closeTo(1, 5),
          preferredChannel: "whatsapp",
        }),
      }),
    );
  });

  it("preferredChannel is null when no channel has enough sends", async () => {
    // Only 2 sends per channel — below MIN_SENDS_FOR_PREFERENCE = 3
    mockDeliverySequence(
      [makeDelivery(true, true), makeDelivery(true, true)],
      [],
    );
    mockDb.whatsAppMessage.findMany.mockResolvedValueOnce([
      { sentAt: new Date(), readAt: new Date() },
      { sentAt: new Date(), readAt: new Date() },
    ]);

    await scorer.recalculate(
      userId,
      tenantId,
      mockDb as unknown as PrismaClient,
    );

    expect(mockDb.userEngagementScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ preferredChannel: null }),
      }),
    );
  });

  it("computes voiceAnswerRate30d from VoiceCall.answeredAt", async () => {
    mockDeliverySequence([], []);
    mockDb.voiceCall.findMany.mockResolvedValueOnce([
      { startedAt: new Date(), answeredAt: new Date(), duration: 45 },
      { startedAt: new Date(), answeredAt: new Date(), duration: 30 },
      { startedAt: new Date(), answeredAt: null, duration: null },
    ]);

    await scorer.recalculate(
      userId,
      tenantId,
      mockDb as unknown as PrismaClient,
    );

    expect(mockDb.userEngagementScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          voiceAnswerRate30d: expect.closeTo(2 / 3, 5),
        }),
      }),
    );
  });
});
