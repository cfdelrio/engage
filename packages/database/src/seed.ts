import { PrismaClient } from '@prisma/client';
import { generateApiKey } from '@engage/core';
import { SYSTEM_EVENT_TYPES } from '@engage/core';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding ProdeCaballito tenant...');

  // ─── Tenant ───────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'prodecaballito' },
    update: {},
    create: {
      slug: 'prodecaballito',
      name: 'ProdeCaballito',
      plan: 'enterprise',
      brandingConfig: {
        primaryColor: '#00b4d8',
        displayName: 'ProdeCaballito',
        supportEmail: 'hola@prodecaballito.com',
      },
      settings: {
        defaultTimezone: 'America/Argentina/Buenos_Aires',
        defaultLocale: 'es-AR',
        maxFrequencyPerDay: 5,
        maxFrequencyPerHour: 2,
        aiConfig: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          temperature: 0.4,
          toneInstructions:
            'Tono futbolero argentino, apasionado, cercano, sin faltas de respeto. Usá lunfardo moderado. Celebrá los logros del usuario.',
          enabled: true,
        },
      },
    },
  });
  console.log(`Tenant: ${tenant.slug} (${tenant.id})`);

  // ─── API Key ───────────────────────────────────────────────────────────────
  const { raw, hash, prefix } = generateApiKey();
  const existingKey = await prisma.tenantApiKey.findFirst({
    where: { tenantId: tenant.id, revokedAt: null },
  });

  if (!existingKey) {
    await prisma.tenantApiKey.create({
      data: {
        tenantId: tenant.id,
        keyHash: hash,
        keyPrefix: prefix,
        name: 'Default Key',
        permissions: ['events:write', 'users:write', 'users:read'],
      },
    });
    console.log(`API Key created: ${raw}`);
    console.log('⚠️  Save this key — it will not be shown again.');
  } else {
    console.log(`API Key already exists (prefix: ${existingKey.keyPrefix}...)`);
  }

  // ─── Event Definitions ────────────────────────────────────────────────────
  const eventDefs = [
    {
      type: SYSTEM_EVENT_TYPES.RANKING_CHANGED,
      description: 'Usuario cambia de posición en el ranking',
      schema: {
        type: 'object',
        required: ['newRank', 'previousRank', 'totalUsers'],
        properties: {
          newRank: { type: 'number' },
          previousRank: { type: 'number' },
          totalUsers: { type: 'number' },
          roundId: { type: 'string' },
        },
      },
    },
    {
      type: SYSTEM_EVENT_TYPES.USER_OVERTAKEN,
      description: 'Otro usuario superó al usuario en el ranking',
      schema: {
        type: 'object',
        required: ['overtakenByUserId', 'newRank'],
        properties: {
          overtakenByUserId: { type: 'string' },
          newRank: { type: 'number' },
          previousRank: { type: 'number' },
        },
      },
    },
    {
      type: SYSTEM_EVENT_TYPES.NEW_LEADER,
      description: 'El usuario tomó el liderazgo',
      schema: {
        type: 'object',
        properties: { roundId: { type: 'string' } },
      },
    },
    {
      type: SYSTEM_EVENT_TYPES.GOAL_SCORED,
      description: 'Gol en un partido del prode',
      schema: {
        type: 'object',
        required: ['matchId', 'team', 'minute'],
        properties: {
          matchId: { type: 'string' },
          team: { type: 'string' },
          minute: { type: 'number' },
          scorer: { type: 'string' },
        },
      },
    },
    {
      type: SYSTEM_EVENT_TYPES.MATCH_STARTED,
      description: 'Inicio de un partido del prode activo',
      schema: {
        type: 'object',
        required: ['matchId'],
        properties: { matchId: { type: 'string' } },
      },
    },
    {
      type: SYSTEM_EVENT_TYPES.ROUND_CLOSED,
      description: 'Cierre de una fecha del prode',
      schema: {
        type: 'object',
        required: ['roundId'],
        properties: { roundId: { type: 'string' } },
      },
    },
    {
      type: SYSTEM_EVENT_TYPES.USER_INACTIVE,
      description: 'Usuario sin actividad por N días',
      schema: {
        type: 'object',
        required: ['daysInactive'],
        properties: { daysInactive: { type: 'number' } },
      },
    },
    {
      type: SYSTEM_EVENT_TYPES.PAYMENT_PENDING,
      description: 'Pago pendiente del usuario',
      schema: {
        type: 'object',
        required: ['amount', 'currency'],
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
          dueDate: { type: 'string' },
        },
      },
    },
    {
      type: SYSTEM_EVENT_TYPES.POLL_VOTED,
      description: 'Usuario votó en una encuesta',
      schema: {
        type: 'object',
        required: ['pollId', 'optionIndex'],
        properties: {
          pollId: { type: 'string' },
          optionIndex: { type: 'number' },
        },
      },
    },
  ];

  for (const def of eventDefs) {
    await prisma.eventDefinition.upsert({
      where: {
        tenantId_type_version: { tenantId: tenant.id, type: def.type, version: 1 },
      },
      update: {},
      create: { tenantId: tenant.id, ...def, version: 1 },
    });
  }
  console.log(`Event definitions: ${eventDefs.length} created/verified`);

  // ─── Base Rules ───────────────────────────────────────────────────────────
  const rules = [
    {
      name: 'Top 3 ranking → Push notification',
      description: 'Notificar cuando el usuario entra al top 3',
      priority: 100,
      conditions: {
        operator: 'AND',
        conditions: [
          { field: 'event.type', operator: 'eq', value: SYSTEM_EVENT_TYPES.RANKING_CHANGED },
          { field: 'event.payload.newRank', operator: 'lte', value: 3 },
          { field: 'event.payload.previousRank', operator: 'gt', value: 3 },
        ],
      },
      actions: [
        {
          type: 'SEND_NOTIFICATION',
          params: { channel: 'push', priority: 'high' },
        },
      ],
      cooldownSeconds: 3600,
    },
    {
      name: 'Caída del top 3 → Push notification',
      description: 'Notificar cuando el usuario cae del top 3',
      priority: 90,
      conditions: {
        operator: 'AND',
        conditions: [
          { field: 'event.type', operator: 'eq', value: SYSTEM_EVENT_TYPES.RANKING_CHANGED },
          { field: 'event.payload.previousRank', operator: 'lte', value: 3 },
          { field: 'event.payload.newRank', operator: 'gt', value: 3 },
        ],
      },
      actions: [{ type: 'SEND_NOTIFICATION', params: { channel: 'push', priority: 'medium' } }],
      cooldownSeconds: 3600,
    },
    {
      name: 'Nuevo líder → Push + Email',
      description: 'Celebrar cuando el usuario toma el liderazgo',
      priority: 110,
      conditions: {
        operator: 'AND',
        conditions: [{ field: 'event.type', operator: 'eq', value: SYSTEM_EVENT_TYPES.NEW_LEADER }],
      },
      actions: [
        { type: 'SEND_NOTIFICATION', params: { channel: 'push', priority: 'high' } },
        { type: 'SEND_NOTIFICATION', params: { channel: 'email', priority: 'medium' } },
      ],
      cooldownSeconds: 86400,
    },
    {
      name: 'Usuario inactivo 7 días → Campaign de reactivación',
      description: 'Agregar a campaña de voz si lleva 7 días inactivo',
      priority: 50,
      conditions: {
        operator: 'AND',
        conditions: [
          { field: 'event.type', operator: 'eq', value: SYSTEM_EVENT_TYPES.USER_INACTIVE },
          { field: 'event.payload.daysInactive', operator: 'gte', value: 7 },
        ],
      },
      actions: [
        {
          type: 'ADD_TO_CAMPAIGN',
          params: { campaignName: 'reactivation_voice', channel: 'voice' },
        },
        { type: 'SEND_NOTIFICATION', params: { channel: 'email', priority: 'low' } },
      ],
      cooldownSeconds: 604800, // 7 days
    },
    {
      name: 'Fatiga alta → Solo digest',
      description: 'Suprimir notificaciones individuales si el usuario está fatigado',
      priority: 200, // highest — evaluated first
      conditions: {
        operator: 'AND',
        conditions: [{ field: 'user.fatigueScore', operator: 'gte', value: 0.8 }],
      },
      actions: [{ type: 'SUPPRESS', params: { reason: 'high_fatigue', allowDigest: true } }],
    },
    {
      name: 'Pago pendiente → Email + SMS',
      description: 'Recordar al usuario su pago pendiente',
      priority: 80,
      conditions: {
        operator: 'AND',
        conditions: [
          { field: 'event.type', operator: 'eq', value: SYSTEM_EVENT_TYPES.PAYMENT_PENDING },
        ],
      },
      actions: [
        { type: 'SEND_NOTIFICATION', params: { channel: 'email', priority: 'high' } },
        { type: 'SEND_NOTIFICATION', params: { channel: 'sms', priority: 'medium' } },
      ],
      cooldownSeconds: 86400,
    },
  ];

  for (const rule of rules) {
    const existing = await prisma.rule.findFirst({
      where: { tenantId: tenant.id, name: rule.name },
    });
    if (!existing) {
      await prisma.rule.create({ data: { tenantId: tenant.id, ...rule } });
    }
  }
  console.log(`Rules: ${rules.length} created/verified`);

  // ─── Public Feed ─────────────────────────────────────────────────────────
  await prisma.publicFeed.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'la-voz-de-la-hinchada' } },
    update: {},
    create: {
      tenantId: tenant.id,
      slug: 'la-voz-de-la-hinchada',
      name: '⚽ La voz de la hinchada',
      type: 'activity',
      isPublic: true,
      config: {
        maxEntries: 50,
        entryTtlHours: 24,
        showReactions: true,
        allowPolls: true,
      },
    },
  });
  console.log('Public feed created/verified');

  // ─── Templates ────────────────────────────────────────────────────────────
  const templates = [
    {
      name: 'Ranking Top 3 — Push',
      channel: 'push',
      subject: '🏆 ¡Entraste al top 3!',
      body: '¡Felicitaciones! Estás en el puesto {{newRank}} con {{totalUsers}} participantes. ¡Seguí así!',
      variables: [{ name: 'newRank', type: 'number' }, { name: 'totalUsers', type: 'number' }],
    },
    {
      name: 'Nuevo Líder — Email',
      channel: 'email',
      subject: '🥇 ¡Sos el líder de ProdeCaballito!',
      body: 'Hola {{userName}},\n\n¡Lo lograste! Estás en el primer lugar del ranking. Mantené ese ritmo.\n\nSaludos,\nEl equipo de ProdeCaballito',
      bodyHtml:
        '<h1>¡Sos el líder! 🥇</h1><p>Hola <strong>{{userName}}</strong>,</p><p>¡Lo lograste! Estás en el primer lugar del ranking.</p>',
      variables: [{ name: 'userName', type: 'string' }],
    },
    {
      name: 'Reactivación — Email',
      channel: 'email',
      subject: '👋 Te extrañamos en ProdeCaballito',
      body: 'Hola {{userName}},\n\nHace {{daysInactive}} días que no entrás. El prode sigue y hay posiciones para subir.\n\nVolvé a jugar: {{loginUrl}}',
      variables: [
        { name: 'userName', type: 'string' },
        { name: 'daysInactive', type: 'number' },
        { name: 'loginUrl', type: 'string' },
      ],
    },
    {
      name: 'Gol — Push',
      channel: 'push',
      subject: '⚽ ¡Goooool!',
      body: '{{team}} anotó en el minuto {{minute}}. ¡Mirá cómo te afecta en el ranking!',
      variables: [{ name: 'team', type: 'string' }, { name: 'minute', type: 'number' }],
    },
  ];

  for (const tmpl of templates) {
    const existing = await prisma.template.findFirst({
      where: { tenantId: tenant.id, name: tmpl.name },
    });
    if (!existing) {
      await prisma.template.create({ data: { tenantId: tenant.id, ...tmpl } });
    }
  }
  console.log(`Templates: ${templates.length} created/verified`);

  console.log('\n✅ Seed completed successfully');
  console.log(`Tenant ID: ${tenant.id}`);
  console.log(`Tenant slug: ${tenant.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
