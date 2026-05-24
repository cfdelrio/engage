import type { PrismaClient } from "@engage/database";

// Minimum sends required before a channel's rate is trusted enough to be "preferred"
const MIN_SENDS_FOR_PREFERENCE = 3;

export class EngagementScorer {
  async recalculate(
    userId: string,
    tenantId: string,
    db: PrismaClient,
  ): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const [
      emailDeliveries30d,
      smsDeliveries30d,
      pushDeliveries30d,
      whatsappMessages30d,
      voiceCalls30d,
      sevenDayDeliveries,
    ] = await Promise.all([
      db.delivery.findMany({
        where: {
          userId,
          tenantId,
          channel: "email",
          sentAt: { gte: thirtyDaysAgo },
        },
        select: { sentAt: true, openedAt: true, clickedAt: true },
      }),
      db.delivery.findMany({
        where: {
          userId,
          tenantId,
          channel: "sms",
          sentAt: { gte: thirtyDaysAgo },
        },
        select: { sentAt: true, deliveredAt: true },
      }),
      db.delivery.findMany({
        where: {
          userId,
          tenantId,
          channel: "push",
          sentAt: { gte: thirtyDaysAgo },
        },
        select: { sentAt: true, openedAt: true },
      }),
      db.whatsAppMessage.findMany({
        where: { userId, tenantId, sentAt: { gte: thirtyDaysAgo } },
        select: { sentAt: true, readAt: true },
      }),
      db.voiceCall.findMany({
        where: { userId, tenantId, startedAt: { gte: thirtyDaysAgo } },
        select: { startedAt: true, answeredAt: true, duration: true },
      }),
      db.delivery.findMany({
        where: { userId, tenantId, sentAt: { gte: sevenDaysAgo } },
        select: { sentAt: true, openedAt: true },
      }),
    ]);

    // ─── Per-channel rates ────────────────────────────────────────────────────

    const emailSent = emailDeliveries30d.filter((d) => d.sentAt).length;
    const emailOpened = emailDeliveries30d.filter((d) => d.openedAt).length;
    const emailClicked = emailDeliveries30d.filter((d) => d.clickedAt).length;
    const emailOpenRate30d = emailSent > 0 ? emailOpened / emailSent : 0;
    const emailClickRate30d = emailSent > 0 ? emailClicked / emailSent : 0;

    const smsSent = smsDeliveries30d.filter((d) => d.sentAt).length;
    const smsDelivered = smsDeliveries30d.filter((d) => d.deliveredAt).length;
    const smsDeliveryRate30d = smsSent > 0 ? smsDelivered / smsSent : 0;

    const pushSent = pushDeliveries30d.filter((d) => d.sentAt).length;
    const pushOpened = pushDeliveries30d.filter((d) => d.openedAt).length;
    const pushOpenRate30d = pushSent > 0 ? pushOpened / pushSent : 0;

    // WhatsApp read receipt is a strong signal — native protocol, no pixel tricks
    const waSent = whatsappMessages30d.filter((m) => m.sentAt).length;
    const waRead = whatsappMessages30d.filter((m) => m.readAt).length;
    const whatsappReadRate30d = waSent > 0 ? waRead / waSent : 0;

    // Voice: answered = call picked up (answeredAt set) OR duration > 0
    const voiceInitiated = voiceCalls30d.filter((c) => c.startedAt).length;
    const voiceAnswered = voiceCalls30d.filter(
      (c) => c.answeredAt != null || (c.duration != null && c.duration > 0),
    ).length;
    const voiceAnswerRate30d =
      voiceInitiated > 0 ? voiceAnswered / voiceInitiated : 0;

    // ─── Global score (backward-compatible) ──────────────────────────────────

    const sent30 = emailSent + smsSent + pushSent + waSent + voiceInitiated;
    const opened30 = emailOpened + waRead + pushOpened;
    const clicked30 = emailClicked;
    const openRate = sent30 > 0 ? opened30 / sent30 : 0;
    const clickRate = sent30 > 0 ? clicked30 / sent30 : 0;
    const engagementScore = Math.min(1, openRate * 0.6 + clickRate * 0.4);

    // ─── Fatigue (7-day rolling, all channels) ────────────────────────────────

    const sent7 = sevenDayDeliveries.filter((d) => d.sentAt).length;
    const opened7 = sevenDayDeliveries.filter((d) => d.openedAt).length;
    const recentOpenRate = sent7 > 0 ? opened7 / sent7 : 0;
    const volumeFactor = Math.min(1, sent7 / 20);
    const engagementDeficit = 1 - recentOpenRate;
    const fatigueScore = Math.min(1, volumeFactor * engagementDeficit);

    // ─── Preferred channel ────────────────────────────────────────────────────
    // Score each channel by engagement quality. WhatsApp reads and voice answers
    // are stronger signals than email opens (which can be inflated by proxies).
    // SMS delivery rate is penalized — it proves deliverability, not engagement.
    // A channel needs MIN_SENDS_FOR_PREFERENCE sends to be eligible.
    const channelScores: Record<string, number> = {};
    if (emailSent >= MIN_SENDS_FOR_PREFERENCE)
      channelScores["email"] = emailOpenRate30d * 0.6 + emailClickRate30d * 0.4;
    if (waSent >= MIN_SENDS_FOR_PREFERENCE)
      channelScores["whatsapp"] = whatsappReadRate30d;
    if (voiceInitiated >= MIN_SENDS_FOR_PREFERENCE)
      channelScores["voice"] = voiceAnswerRate30d;
    if (pushSent >= MIN_SENDS_FOR_PREFERENCE)
      channelScores["push"] = pushOpenRate30d;
    if (smsSent >= MIN_SENDS_FOR_PREFERENCE)
      channelScores["sms"] = smsDeliveryRate30d * 0.4; // low-confidence signal

    const preferredChannel =
      Object.keys(channelScores).length > 0
        ? (Object.entries(channelScores).sort(
            ([, a], [, b]) => b - a,
          )[0]?.[0] ?? null)
        : null;

    // ─── Persist ──────────────────────────────────────────────────────────────

    await db.userEngagementScore.upsert({
      where: { userId },
      update: {
        score: engagementScore,
        fatigueScore,
        openRate30d: openRate,
        clickRate30d: clickRate,
        emailOpenRate30d,
        emailClickRate30d,
        whatsappReadRate30d,
        smsDeliveryRate30d,
        voiceAnswerRate30d,
        pushOpenRate30d,
        preferredChannel,
        lastCalculatedAt: new Date(),
      },
      create: {
        userId,
        tenantId,
        score: engagementScore,
        fatigueScore,
        openRate30d: openRate,
        clickRate30d: clickRate,
        emailOpenRate30d,
        emailClickRate30d,
        whatsappReadRate30d,
        smsDeliveryRate30d,
        voiceAnswerRate30d,
        pushOpenRate30d,
        preferredChannel,
      },
    });
  }
}
