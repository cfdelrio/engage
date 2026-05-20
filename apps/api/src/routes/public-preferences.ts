import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticatePreferenceToken } from '../plugins/preference-token-auth.js';

const UserPreferenceResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  channel: z.enum(['email', 'sms', 'push', 'whatsapp', 'voice']),
  category: z.string().optional(),
  enabled: z.boolean(),
  quietHoursStart: z.number().int().min(0).max(1439).nullable(),
  quietHoursEnd: z.number().int().min(0).max(1439).nullable(),
});

const UpdatePreferenceSchema = z.object({
  channel: z.enum(['email', 'sms', 'push', 'whatsapp', 'voice']),
  category: z.string().optional(),
  enabled: z.boolean().optional(),
  quietHoursStart: z.number().int().min(0).max(1439).nullable().optional(),
  quietHoursEnd: z.number().int().min(0).max(1439).nullable().optional(),
});

const UpdateMultiplePreferencesSchema = z.object({
  preferences: z.array(UpdatePreferenceSchema.required({
    channel: true,
  })),
});

type UserPreferenceResponse = z.infer<typeof UserPreferenceResponseSchema>;
type UpdatePreferenceRequest = z.infer<typeof UpdatePreferenceSchema>;

export interface PublicPreferencesResponse {
  preferences: UserPreferenceResponse[];
  user: {
    email?: string;
    phone?: string;
    timezone: string;
  };
}

export async function publicPreferencesRoutes(app: FastifyInstance) {
  // GET /v1/public/preferences - Fetch user preferences
  app.get(
    '/v1/public/preferences',
    { onRequest: authenticatePreferenceToken },
    async (request, reply) => {
      const { userId, tenantId } = request.preferenceToken!;
      const query = request.query as { category?: string; channel?: string };
      const { category, channel } = query;

      try {
        const user = await app.prisma.user.findUnique({
          where: { id: userId },
          select: {
            email: true,
            phone: true,
            timezone: true,
          },
        });

        if (!user) {
          return reply.status(404).send({ error: 'User not found' });
        }

        const filter: any = { userId, tenantId };
        if (channel) filter.channel = channel;
        if (category) {
          filter.category = category;
        }

        const preferences = await app.prisma.userPreference.findMany({
          where: filter,
          orderBy: [{ channel: 'asc' }, { category: 'asc' }],
        });

        const response: PublicPreferencesResponse = {
          preferences: preferences.map(p => ({
            id: p.id,
            userId: p.userId,
            channel: p.channel as any,
            category: p.category || undefined,
            enabled: p.enabled,
            quietHoursStart: p.quietHoursStart,
            quietHoursEnd: p.quietHoursEnd,
          })),
          user: {
            email: user.email || undefined,
            phone: user.phone || undefined,
            timezone: user.timezone,
          },
        };

        return reply.send(response);
      } catch (error) {
        app.log.error(error, 'Failed to fetch preferences');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );

  // PUT /v1/public/preferences - Update preferences
  app.put<{ Body: any }>(
    '/v1/public/preferences',
    { onRequest: authenticatePreferenceToken },
    async (request, reply) => {
      const { userId, tenantId } = request.preferenceToken!;

      try {
        const parsed = UpdateMultiplePreferencesSchema.parse(request.body);
        const { preferences: updatesList } = parsed;

        const updated: UserPreferenceResponse[] = [];

        for (const update of updatesList) {
          // First try to find existing preference
          let preference = await app.prisma.userPreference.findFirst({
            where: {
              userId,
              tenantId,
              channel: update.channel,
              category: update.category,
            },
          });

          if (preference) {
            // Update existing
            const updateData: any = {};
            if (update.enabled !== undefined) updateData.enabled = update.enabled;
            if ('quietHoursStart' in update) updateData.quietHoursStart = update.quietHoursStart;
            if ('quietHoursEnd' in update) updateData.quietHoursEnd = update.quietHoursEnd;

            preference = await app.prisma.userPreference.update({
              where: { id: preference.id },
              data: updateData,
            });
          } else {
            // Create new
            const createData: any = {
              userId,
              tenantId,
              channel: update.channel,
              enabled: update.enabled !== false,
              quietHoursStart: update.quietHoursStart ?? null,
              quietHoursEnd: update.quietHoursEnd ?? null,
            };
            if (update.category) {
              createData.category = update.category;
            }
            preference = await app.prisma.userPreference.create({
              data: createData,
            });
          }

          updated.push({
            id: preference.id,
            userId: preference.userId,
            channel: preference.channel as any,
            category: preference.category || undefined,
            enabled: preference.enabled,
            quietHoursStart: preference.quietHoursStart,
            quietHoursEnd: preference.quietHoursEnd,
          });
        }

        return reply.send(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation error',
            details: error.errors,
          });
        }

        app.log.error(error, 'Failed to update preferences');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );

  // POST /v1/public/preferences/opt-out - Global unsubscribe
  app.post(
    '/v1/public/preferences/opt-out',
    { onRequest: authenticatePreferenceToken },
    async (request, reply) => {
      const { userId, tenantId } = request.preferenceToken!;

      try {
        // Disable all channels
        await app.prisma.userPreference.updateMany({
          where: { userId, tenantId },
          data: { enabled: false },
        });

        // Record global unsubscribe
        await app.prisma.globalUnsubscribe.create({
          data: {
            userId,
            tenantId,
            channel: 'all' as any,
            reason: 'user_request',
          },
        });

        return reply.send({ success: true, message: 'Successfully opted out' });
      } catch (error) {
        app.log.error(error, 'Failed to opt out');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );
}
