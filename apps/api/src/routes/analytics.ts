import type { FastifyPluginAsync } from 'fastify';

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticateApiKey);

  fastify.get('/overview', async (request) => {
    const tenantId = request.tenantId;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const [totalDeliveries, deliveryByStatus, recentEvents, totalUsers] = await Promise.all([
      fastify.prisma.delivery.count({ where: { tenantId } }),
      fastify.prisma.delivery.groupBy({
        by: ['status'],
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

  fastify.get('/channels', async (request) => {
    const tenantId = request.tenantId;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    return fastify.prisma.delivery.groupBy({
      by: ['channel', 'status'],
      where: { tenantId, createdAt: { gte: sevenDaysAgo } },
      _count: true,
    });
  });

  fastify.get('/events', async (request) => {
    const tenantId = request.tenantId;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    return fastify.prisma.event.groupBy({
      by: ['type'],
      where: { tenantId, receivedAt: { gte: sevenDaysAgo } },
      _count: true,
      orderBy: { _count: { type: 'desc' } },
    });
  });

  fastify.get('/ai-performance', async (request) => {
    const tenantId = request.tenantId;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const [total, aiGenerated] = await Promise.all([
      fastify.prisma.engagementDecision.count({ where: { tenantId } }),
      fastify.prisma.engagementDecision.count({
        where: { tenantId, aiGenerated: true, createdAt: { gte: sevenDaysAgo } },
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
