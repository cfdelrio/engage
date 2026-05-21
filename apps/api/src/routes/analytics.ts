import type { FastifyPluginAsync } from "fastify";

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticateApiKey);

  fastify.get("/overview", async (request) => {
    const tenantId = request.tenantId;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const [totalDeliveries, deliveryByStatus, recentEvents, totalUsers] =
      await Promise.all([
        fastify.prisma.delivery.count({ where: { tenantId } }),
        fastify.prisma.delivery.groupBy({
          by: ["status"],
          where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
          _count: true,
        }),
        fastify.prisma.event.count({
          where: { tenantId, receivedAt: { gte: thirtyDaysAgo } },
        }),
        fastify.prisma.user.count({ where: { tenantId } }),
      ]);

    return { totalDeliveries, deliveryByStatus, recentEvents, totalUsers };
  });

  fastify.get("/channels", async (request) => {
    const tenantId = request.tenantId;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    return fastify.prisma.delivery.groupBy({
      by: ["channel", "status"],
      where: { tenantId, createdAt: { gte: sevenDaysAgo } },
      _count: true,
    });
  });

  fastify.get("/events", async (request) => {
    const tenantId = request.tenantId;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    return fastify.prisma.event.groupBy({
      by: ["type"],
      where: { tenantId, receivedAt: { gte: sevenDaysAgo } },
      _count: true,
      orderBy: { _count: { type: "desc" } },
    });
  });

  // Daily delivery counts per channel for the last N days. Pivots a date-truncated
  // groupBy into one row per day with one number column per channel — the shape
  // a Recharts <LineChart /> expects without further client-side transformation.
  fastify.get("/timeseries", async (request) => {
    const tenantId = request.tenantId;
    const query = request.query as { windowDays?: string };
    const windowDays = Math.min(
      Math.max(parseInt(query.windowDays ?? "7", 10) || 7, 1),
      90,
    );
    const windowStart = new Date(Date.now() - windowDays * 24 * 3600 * 1000);
    windowStart.setUTCHours(0, 0, 0, 0);

    const rows = await fastify.prisma.$queryRaw<
      Array<{ day: Date; channel: string; count: bigint }>
    >`
      SELECT
        date_trunc('day', "createdAt") AS day,
        "channel",
        COUNT(*) AS count
      FROM "Delivery"
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= ${windowStart}
      GROUP BY day, "channel"
      ORDER BY day ASC
    `;

    const channels = ["email", "sms", "push", "whatsapp", "voice"] as const;
    type ChannelKey = (typeof channels)[number];

    // Pre-fill every day in the window with zeros so the chart renders gaps as 0.
    const byDay = new Map<
      string,
      Record<ChannelKey, number> & { date: string }
    >();
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(windowStart);
      d.setUTCDate(windowStart.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, {
        date: key,
        email: 0,
        sms: 0,
        push: 0,
        whatsapp: 0,
        voice: 0,
      });
    }

    for (const row of rows) {
      const dayKey = row.day.toISOString().slice(0, 10);
      const entry = byDay.get(dayKey);
      if (!entry) continue;
      if (channels.includes(row.channel as ChannelKey)) {
        entry[row.channel as ChannelKey] = Number(row.count);
      }
    }

    return {
      windowDays,
      series: Array.from(byDay.values()),
    };
  });

  fastify.get("/ai-performance", async (request) => {
    const tenantId = request.tenantId;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const [total, aiGenerated] = await Promise.all([
      fastify.prisma.engagementDecision.count({ where: { tenantId } }),
      fastify.prisma.engagementDecision.count({
        where: {
          tenantId,
          aiGenerated: true,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    return {
      total,
      aiGenerated,
      aiAdoptionRate: total > 0 ? aiGenerated / total : 0,
    };
  });
};

export default analyticsRoutes;
