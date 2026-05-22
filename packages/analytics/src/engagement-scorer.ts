import type { PrismaClient } from "@engage/database";

export class EngagementScorer {
  async recalculate(
    userId: string,
    tenantId: string,
    db: PrismaClient,
  ): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const [thirtyDayDeliveries, sevenDayDeliveries] = await Promise.all([
      db.delivery.findMany({
        where: { userId, tenantId, sentAt: { gte: thirtyDaysAgo } },
        select: { sentAt: true, openedAt: true, clickedAt: true },
      }),
      db.delivery.findMany({
        where: { userId, tenantId, sentAt: { gte: sevenDaysAgo } },
        select: { sentAt: true, openedAt: true },
      }),
    ]);

    const sent30 = thirtyDayDeliveries.filter(
      (d: (typeof thirtyDayDeliveries)[0]) => d.sentAt,
    ).length;
    const opened30 = thirtyDayDeliveries.filter(
      (d: (typeof thirtyDayDeliveries)[0]) => d.openedAt,
    ).length;
    const clicked30 = thirtyDayDeliveries.filter(
      (d: (typeof thirtyDayDeliveries)[0]) => d.clickedAt,
    ).length;

    const openRate = sent30 > 0 ? opened30 / sent30 : 0;
    const clickRate = sent30 > 0 ? clicked30 / sent30 : 0;
    const engagementScore = Math.min(1, openRate * 0.6 + clickRate * 0.4);

    const sent7 = sevenDayDeliveries.filter(
      (d: (typeof sevenDayDeliveries)[0]) => d.sentAt,
    ).length;
    const opened7 = sevenDayDeliveries.filter(
      (d: (typeof sevenDayDeliveries)[0]) => d.openedAt,
    ).length;
    const recentOpenRate = sent7 > 0 ? opened7 / sent7 : 0;

    // High volume + low engagement = high fatigue
    const volumeFactor = Math.min(1, sent7 / 20);
    const engagementDeficit = 1 - recentOpenRate;
    const fatigueScore = Math.min(1, volumeFactor * engagementDeficit);

    await db.userEngagementScore.upsert({
      where: { userId },
      update: {
        score: engagementScore,
        fatigueScore,
        openRate30d: openRate,
        clickRate30d: clickRate,
        lastCalculatedAt: new Date(),
      },
      create: {
        userId,
        tenantId,
        score: engagementScore,
        fatigueScore,
        openRate30d: openRate,
        clickRate30d: clickRate,
      },
    });
  }
}
