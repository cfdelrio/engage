import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ProdeCaballito tenant...');

  // Create ProdeCaballito tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'prodecaballito' },
    update: {},
    create: {
      slug: 'prodecaballito',
      name: 'ProdeCaballito',
      plan: 'enterprise',
      settings: {
        aiConfig: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          temperature: 0.3,
          toneInstructions: 'Tono futbolero argentino, apasionado pero respetoso',
          enabled: true,
        },
      },
    },
  });

  console.log(`Tenant: ${tenant.slug} (${tenant.id})`);

  // Create API key
  const rawKey = `oek_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 10);

  const apiKey = await prisma.tenantApiKey.upsert({
    where: { keyHash },
    update: {},
    create: {
      tenantId: tenant.id,
      keyHash,
      keyPrefix,
      name: 'Development Key',
      permissions: ['events:write', 'events:read'],
    },
  });

  console.log(`API Key created: ${keyPrefix}...`);
  console.log(`⚠️  Save this key — it will not be shown again.`);
  console.log(`${rawKey}`);

  // Create event definitions
  const eventTypes = [
    { type: 'prode.ranking.changed', description: 'User ranking changed' },
    { type: 'prode.goal.scored', description: 'Goal scored' },
    { type: 'prode.match.started', description: 'Match started' },
    { type: 'user.inactive', description: 'User inactive' },
    { type: 'user.engagement.low', description: 'Low engagement' },
    { type: 'payment.pending', description: 'Payment pending' },
    { type: 'poll.voted', description: 'Poll voted' },
    { type: 'user.overtaken', description: 'User overtaken in ranking' },
    { type: 'new.leader', description: 'New leader' },
  ];

  let eventCount = 0;
  for (const eventType of eventTypes) {
    await prisma.eventDefinition.create({
      data: {
        tenantId: tenant.id,
        type: eventType.type,
        description: eventType.description,
        schema: {},
        version: 1,
      },
    }).catch(() => {
      // Ignore duplicate constraint errors
    });
    eventCount++;
  }

  console.log(`Event definitions: ${eventCount} created/verified`);

  // Create base rules (just create, ignore duplicates)
  const rules = [
    {
      name: 'Top 3 Rankings - Send Push',
      priority: 10,
      conditions: {
        operator: 'AND',
        conditions: [
          { field: 'event.type', operator: 'eq', value: 'prode.ranking.changed' },
          { field: 'event.payload.newRank', operator: 'lte', value: 3 },
        ],
      },
      actions: [{ type: 'SEND_NOTIFICATION', params: { channel: 'push', priority: 'high' } }],
    },
    {
      name: 'High Fatigue - Suppress',
      priority: 5,
      conditions: {
        operator: 'AND',
        conditions: [{ field: 'user.fatigueScore', operator: 'gt', value: 0.8 }],
      },
      actions: [{ type: 'SUPPRESS', params: { except: 'digest' } }],
    },
    {
      name: 'Inactive 7 Days - Reactivate',
      priority: 8,
      conditions: {
        operator: 'AND',
        conditions: [
          { field: 'event.type', operator: 'eq', value: 'user.inactive' },
          { field: 'user.daysInactive', operator: 'gte', value: 7 },
        ],
      },
      actions: [{ type: 'ADD_TO_CAMPAIGN', params: { campaignId: 'reactivation' } }],
    },
    {
      name: 'Overtaken - Voice Call',
      priority: 9,
      conditions: {
        operator: 'AND',
        conditions: [{ field: 'event.type', operator: 'eq', value: 'user.overtaken' }],
      },
      actions: [{ type: 'SEND_NOTIFICATION', params: { channel: 'voice' } }],
    },
    {
      name: 'Payment Pending - Email',
      priority: 7,
      conditions: {
        operator: 'AND',
        conditions: [{ field: 'event.type', operator: 'eq', value: 'payment.pending' }],
      },
      actions: [{ type: 'SEND_NOTIFICATION', params: { channel: 'email' } }],
    },
    {
      name: 'New Leader - SMS Alert',
      priority: 6,
      conditions: {
        operator: 'AND',
        conditions: [{ field: 'event.type', operator: 'eq', value: 'new.leader' }],
      },
      actions: [{ type: 'SEND_NOTIFICATION', params: { channel: 'sms' } }],
    },
  ];

  for (const rule of rules) {
    await prisma.rule.create({
      data: {
        tenantId: tenant.id,
        name: rule.name,
        priority: rule.priority,
        enabled: true,
        conditions: rule.conditions,
        actions: rule.actions,
      },
    }).catch(() => {
      // Ignore duplicate errors
    });
  }

  console.log(`Rules: ${rules.length} created/verified`);

  // Create public feed
  await prisma.publicFeed.create({
    data: {
      tenantId: tenant.id,
      slug: 'prodecaballito-updates',
      name: 'ProdeCaballito Updates',
      type: 'activity_feed',
      config: {},
      isPublic: true,
    },
  }).catch(() => {});

  console.log(`Public feed created/verified`);

  // Create templates
  const templates = [
    { name: 'ranking_top3', channel: 'push', subject: '¡Entraste al top 3!', body: 'Felicidades, estás en el top 3 del prode.' },
    { name: 'goal_scored', channel: 'sms', subject: '', body: 'Gol de tu equipo! ${team} marcó.' },
    { name: 'reactivation', channel: 'email', subject: 'Te echamos de menos', body: 'Hace días que no jugas. Volvé al prode!' },
    { name: 'overtaken', channel: 'voice', subject: '', body: 'Has sido superado en el ranking.' },
  ];

  for (const template of templates) {
    await prisma.template.create({
      data: {
        tenantId: tenant.id,
        name: template.name,
        channel: template.channel,
        subject: template.subject,
        body: template.body,
        variables: [],
        version: 1,
      },
    }).catch(() => {});
  }

  console.log(`Templates: ${templates.length} created/verified`);

  console.log('\n✅ Seed completed successfully');
  console.log('\n📋 Summary:');
  console.log(`Tenant ID: ${tenant.id}`);
  console.log(`Tenant slug: ${tenant.slug}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
