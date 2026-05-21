import type { FastifyPluginAsync } from "fastify";

interface FeedEntry {
  id: string;
  type: string;
  content: unknown;
  priority: number;
  expiresAt: Date | null;
  createdAt: Date;
}

const embedRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { token: string } }>(
    "/feed/:token",
    async (request, reply) => {
      const { token } = request.params;

      const feed = await fastify.prisma.publicFeed.findFirst({
        where: { embedToken: token, isPublic: true },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          config: true,
        },
      });

      if (!feed) {
        return reply.status(404).send({ error: "Feed not found" });
      }

      const now = new Date();
      const entries: FeedEntry[] = await fastify.prisma.feedEntry.findMany({
        where: {
          feedId: feed.id,
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 30,
        select: {
          id: true,
          type: true,
          content: true,
          priority: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      return reply.send({ feed, entries });
    },
  );
};

export default embedRoutes;
