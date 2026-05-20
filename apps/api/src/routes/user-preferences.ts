import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@engage/database';
import type {
  UserPreferenceResponse,
  UpdateUserPreferenceRequest,
  BulkUpdateUserPreferenceRequest,
  ApiErrorResponse,
} from '@engage/core';

const userPreferencesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticateApiKey);

  const VALID_CHANNELS = ['email', 'sms', 'push', 'whatsapp', 'voice'];

  const updatePreferenceSchema = z.object({
    channel: z.string().min(1),
    category: z.string().optional(),
    enabled: z.boolean().optional(),
    quietHoursStart: z.number().int().min(0).max(1439).nullable().optional(),
    quietHoursEnd: z.number().int().min(0).max(1439).nullable().optional(),
  });

  /**
   * GET /v1/users/:userId/preferences
   * List all preferences for a user
   */
  fastify.get<{ Params: { userId: string }; Reply: UserPreferenceResponse[] | ApiErrorResponse }>(
    '/users/:userId/preferences',
    async (request, reply) => {
      try {
        const { userId } = request.params;

        // Verify user exists in tenant
        const user = await prisma.user.findFirst({
          where: { id: userId, tenantId: request.tenantId },
        });

        if (!user) {
          return reply.status(404).send({ error: 'User not found', code: 'NOT_FOUND' } as ApiErrorResponse);
        }

        const preferences = await prisma.userPreference.findMany({
          where: { userId, tenantId: request.tenantId },
          orderBy: [{ channel: 'asc' }, { category: 'asc' }],
        });

        return reply.status(200).send(
          preferences.map((p) => ({
            userId: p.userId,
            tenantId: p.tenantId,
            channel: p.channel,
            category: p.category,
            enabled: p.enabled,
            quietHoursStart: p.quietHoursStart,
            quietHoursEnd: p.quietHoursEnd,
            updatedAt: p.updatedAt.toISOString(),
          })) as UserPreferenceResponse[],
        );
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: 'Failed to fetch preferences', code: 'INTERNAL_ERROR' } as ApiErrorResponse);
      }
    },
  );

  /**
   * GET /v1/users/:userId/preferences/:channel
   * Get preference for a specific channel
   */
  fastify.get<{ Params: { userId: string; channel: string }; Reply: UserPreferenceResponse | ApiErrorResponse }>(
    '/users/:userId/preferences/:channel',
    async (request, reply) => {
      try {
        const { userId, channel } = request.params;
        const category = (request.query as any).category || 'all';

        const preference = await prisma.userPreference.findUnique({
          where: {
            userId_tenantId_channel_category: {
              userId,
              tenantId: request.tenantId,
              channel,
              category,
            },
          },
        });

        if (!preference) {
          return reply.status(404).send({ error: 'Preference not found', code: 'NOT_FOUND' } as ApiErrorResponse);
        }

        return reply.status(200).send({
          userId: preference.userId,
          tenantId: preference.tenantId,
          channel: preference.channel,
          category: preference.category,
          enabled: preference.enabled,
          quietHoursStart: preference.quietHoursStart,
          quietHoursEnd: preference.quietHoursEnd,
          updatedAt: preference.updatedAt.toISOString(),
        } as UserPreferenceResponse);
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: 'Failed to fetch preference', code: 'INTERNAL_ERROR' } as ApiErrorResponse);
      }
    },
  );

  /**
   * PUT /v1/users/:userId/preferences
   * Update multiple preferences (bulk)
   */
  fastify.put<{
    Params: { userId: string };
    Body: BulkUpdateUserPreferenceRequest;
    Reply: UserPreferenceResponse[] | ApiErrorResponse;
  }>('/users/:userId/preferences', async (request, reply) => {
    try {
      const { userId } = request.params;
      const { preferences } = z
        .object({
          preferences: z.array(updatePreferenceSchema),
        })
        .parse(request.body);

      // Verify user exists
      const user = await prisma.user.findFirst({
        where: { id: userId, tenantId: request.tenantId },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found', code: 'NOT_FOUND' } as ApiErrorResponse);
      }

      // Update all preferences
      const updated = await Promise.all(
        preferences.map((pref) =>
          prisma.userPreference.upsert({
            where: {
              userId_tenantId_channel_category: {
                userId,
                tenantId: request.tenantId,
                channel: pref.channel,
                category: pref.category || 'all',
              },
            },
            create: {
              userId,
              tenantId: request.tenantId,
              channel: pref.channel,
              category: pref.category || 'all',
              enabled: pref.enabled ?? true,
              quietHoursStart: pref.quietHoursStart ?? null,
              quietHoursEnd: pref.quietHoursEnd ?? null,
            },
            update: {
              ...(pref.enabled !== undefined ? { enabled: pref.enabled } : {}),
              ...(pref.quietHoursStart !== undefined ? { quietHoursStart: pref.quietHoursStart } : {}),
              ...(pref.quietHoursEnd !== undefined ? { quietHoursEnd: pref.quietHoursEnd } : {}),
            },
          }),
        ),
      );

      return reply.status(200).send(
        updated.map((p) => ({
          userId: p.userId,
          tenantId: p.tenantId,
          channel: p.channel,
          category: p.category,
          enabled: p.enabled,
          quietHoursStart: p.quietHoursStart,
          quietHoursEnd: p.quietHoursEnd,
          updatedAt: p.updatedAt.toISOString(),
        })) as UserPreferenceResponse[],
      );
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to update preferences', code: 'INTERNAL_ERROR' } as ApiErrorResponse);
    }
  });

  /**
   * DELETE /v1/users/:userId/preferences/:channel
   * Disable a channel (soft delete)
   */
  fastify.delete<{ Params: { userId: string; channel: string }; Reply: void | ApiErrorResponse }>(
    '/users/:userId/preferences/:channel',
    async (request, reply) => {
      try {
        const { userId, channel } = request.params;
        const category = (request.query as any).category || 'all';

        const preference = await prisma.userPreference.findUnique({
          where: {
            userId_tenantId_channel_category: {
              userId,
              tenantId: request.tenantId,
              channel,
              category,
            },
          },
        });

        if (!preference) {
          return reply.status(404).send({ error: 'Preference not found', code: 'NOT_FOUND' } as ApiErrorResponse);
        }

        await prisma.userPreference.update({
          where: {
            userId_tenantId_channel_category: {
              userId,
              tenantId: request.tenantId,
              channel,
              category,
            },
          },
          data: { enabled: false },
        });

        return reply.status(204);
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: 'Failed to disable preference', code: 'INTERNAL_ERROR' } as ApiErrorResponse);
      }
    },
  );

  /**
   * POST /v1/users/:userId/preferences/reset
   * Reset preferences to defaults (all channels enabled, no quiet hours)
   */
  fastify.post<{ Params: { userId: string }; Reply: void | ApiErrorResponse }>(
    '/users/:userId/preferences/reset',
    async (request, reply) => {
      try {
        const { userId } = request.params;

        // Verify user exists
        const user = await prisma.user.findFirst({
          where: { id: userId, tenantId: request.tenantId },
        });

        if (!user) {
          return reply.status(404).send({ error: 'User not found', code: 'NOT_FOUND' } as ApiErrorResponse);
        }

        // Delete all preferences (will revert to defaults on next query)
        await prisma.userPreference.deleteMany({
          where: { userId, tenantId: request.tenantId },
        });

        return reply.status(204);
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: 'Failed to reset preferences', code: 'INTERNAL_ERROR' } as ApiErrorResponse);
      }
    },
  );
};

export default userPreferencesRoutes;
