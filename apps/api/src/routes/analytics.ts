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

  // Enhanced overview with KPI metrics
  fastify.get("/overview-v2", async (request) => {
    const tenantId = request.tenantId;
    const query = request.query as { from?: string; to?: string };
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    // Previous period for comparison
    const periodLength = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - periodLength);

    const [currentDeliveries, prevDeliveries] = await Promise.all([
      fastify.prisma.delivery.findMany({
        where: { tenantId, createdAt: { gte: from, lte: to } },
        select: { status: true },
      }),
      fastify.prisma.delivery.findMany({
        where: { tenantId, createdAt: { gte: prevFrom, lte: from } },
        select: { status: true },
      }),
    ]);

    const calcMetrics = (deliveries: typeof currentDeliveries) => {
      const totalSent = deliveries.length;
      const delivered = deliveries.filter(
        (d) => d.status === "delivered",
      ).length;
      const opened = deliveries.filter((d) => d.status === "opened").length;
      const clicked = deliveries.filter((d) => d.status === "clicked").length;

      return {
        totalSent,
        totalDelivered: delivered,
        deliveryRate: totalSent > 0 ? delivered / totalSent : 0,
        openRate: delivered > 0 ? opened / delivered : 0,
        clickRate: opened > 0 ? clicked / opened : 0,
        conversionRate: opened > 0 ? clicked / opened : 0,
      };
    };

    const current = calcMetrics(currentDeliveries);
    const prev = calcMetrics(prevDeliveries);

    return {
      ...current,
      previousPeriod: prev,
    };
  });

  // Detailed channel metrics
  fastify.get("/channels-detailed", async (request) => {
    const tenantId = request.tenantId;
    const query = request.query as { from?: string; to?: string };
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    const channels = ["email", "sms", "push", "whatsapp", "voice"] as const;
    const metrics = [];

    for (const channel of channels) {
      const deliveries = await fastify.prisma.delivery.findMany({
        where: { tenantId, channel, createdAt: { gte: from, lte: to } },
        select: { status: true },
      });

      const sent = deliveries.length;
      const delivered = deliveries.filter(
        (d) => d.status === "delivered",
      ).length;
      const opened = deliveries.filter((d) => d.status === "opened").length;
      const clicked = deliveries.filter((d) => d.status === "clicked").length;

      metrics.push({
        channel,
        sent,
        delivered,
        opened,
        clicked,
        deliveryRate: sent > 0 ? delivered / sent : 0,
        openRate: delivered > 0 ? opened / delivered : 0,
        clickRate: opened > 0 ? clicked / opened : 0,
      });
    }

    return metrics.filter((m) => m.sent > 0);
  });

  // Time series with engagement metrics
  fastify.get("/timeseries-v2", async (request) => {
    const tenantId = request.tenantId;
    const query = request.query as { from?: string; to?: string };
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    from.setUTCHours(0, 0, 0, 0);

    const rows = await fastify.prisma.$queryRaw<
      Array<{ date: Date; status: string; count: bigint }>
    >`
      SELECT
        date_trunc('day', "createdAt") AS date,
        "status",
        COUNT(*) AS count
      FROM "Delivery"
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= ${from}
        AND "createdAt" <= ${to}
      GROUP BY date, "status"
      ORDER BY date ASC
    `;

    const byDate = new Map<string, Record<string, number> & { date: string }>();
    const dayCount =
      Math.ceil((to.getTime() - from.getTime()) / (24 * 3600 * 1000)) + 1;

    for (let i = 0; i < dayCount; i++) {
      const d = new Date(from);
      d.setUTCDate(from.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      byDate.set(key, {
        date: key,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
      });
    }

    for (const row of rows) {
      const dateKey = row.date.toISOString().slice(0, 10);
      const entry = byDate.get(dateKey);
      if (!entry) continue;
      if (row.status === "sent" || row.status === "queued") {
        entry.sent += Number(row.count);
      } else {
        (entry as Record<string, number>)[row.status] = Number(row.count);
      }
    }

    return Array.from(byDate.values());
  });

  // Campaign performance metrics
  fastify.get("/campaigns", async (request) => {
    const tenantId = request.tenantId;
    const query = request.query as { from?: string; to?: string };
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    const campaigns = await fastify.prisma.campaign.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      take: 50,
    });

    const metrics = await Promise.all(
      campaigns.map(async (campaign) => {
        const deliveries = await fastify.prisma.delivery.findMany({
          where: {
            tenantId,
            engagementDecision: { campaignId: campaign.id },
            createdAt: { gte: from, lte: to },
          },
          select: { status: true },
        });

        const sent = deliveries.length;
        const delivered = deliveries.filter(
          (d) => d.status === "delivered",
        ).length;
        const opened = deliveries.filter((d) => d.status === "opened").length;
        const clicked = deliveries.filter((d) => d.status === "clicked").length;

        return {
          id: campaign.id,
          name: campaign.name,
          type: campaign.type || "unknown",
          status: campaign.status || "draft",
          sent,
          delivered,
          opened,
          clicked,
          converted: 0, // TODO: add conversion tracking
          deliveryRate: sent > 0 ? delivered / sent : 0,
          openRate: delivered > 0 ? opened / delivered : 0,
          clickRate: opened > 0 ? clicked / opened : 0,
          conversionRate: 0,
          createdAt: campaign.createdAt.toISOString(),
        };
      }),
    );

    return metrics.filter((m) => m.sent > 0).sort((a, b) => b.sent - a.sent);
  });
};

export default analyticsRoutes;
