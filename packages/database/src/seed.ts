import { PrismaClient } from '@prisma/client';
import { hash } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

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

  console.log(`✅ Tenant created: ${tenant.slug}`);

  // Create API key
  const rawKey = `pk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  const keyHash = hash('sha256').update(rawKey).digest('hex');
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

  console.log(`✅ API Key created: ${keyPrefix}...`);
  console.log(`   Full key (save this): ${rawKey}`);

  // Create event definitions
  const eventTypes = [
    { type: 'prode.ranking.changed', description: 'User ranking changed in Prode' },
    { type: 'prode.goal.scored', description: 'Goal scored by followed team' },
    { type: 'prode.match.started', description: 'Match started' },
    { type: 'user.inactive', description: 'User inactive for 7+ days' },
    { type: 'user.engagement.low', description: 'Low engagement score' },
  ];

  for (const eventType of eventTypes) {
    await prisma.eventDefinition.upsert({
      where: {
        tenantId_type: {
          tenantId: tenant.id,
          type: eventType.type,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        type: eventType.type,
        description: eventType.description,
        schema: {},
        version: 1,
      },
    });
  }

  console.log(`✅ Event definitions created`);

  // Create base rules
  const rule1 = await prisma.rule.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'Top 3 Rankings - Send Push',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Top 3 Rankings - Send Push',
      enabled: true,
      priority: 10,
      conditions: {
        operator: 'AND',
        conditions: [
          {
            field: 'event.type',
            operator: 'eq',
            value: 'prode.ranking.changed',
          },
          {
            field: 'event.payload.newRank',
            operator: 'lte',
            value: 3,
          },
        ],
      },
      actions: [
        {
          type: 'SEND_NOTIFICATION',
          params: {
            channel: 'push',
            templateId: 'ranking_top3',
            priority: 'high',
          },
        },
      ],
    },
  });

  const rule2 = await prisma.rule.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'High Fatigue - Digest Only',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'High Fatigue - Digest Only',
      enabled: true,
      priority: 5,
      conditions: {
        operator: 'AND',
        conditions: [
          {
            field: 'user.fatigueScore',
            operator: 'gt',
            value: 0.8,
          },
        ],
      },
      actions: [
        {
          type: 'SUPPRESS',
          params: {
            except: 'digest',
          },
        },
      ],
    },
  });

  console.log(`✅ Rules created`);

  // Create test user
  const testUser = await prisma.user.upsert({
    where: {
      tenantId_externalId: {
        tenantId: tenant.id,
        externalId: 'test-user-1',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      externalId: 'test-user-1',
      email: 'test@prodecaballito.local',
      phone: '+5491123456789',
      timezone: 'America/Argentina/Buenos_Aires',
      locale: 'es-AR',
      metadata: {
        name: 'Test User',
        joinedAt: new Date().toISOString(),
      },
    },
  });

  console.log(`✅ Test user created: ${testUser.externalId}`);

  // Create channel providers
  const emailProvider = await prisma.channelProvider.upsert({
    where: {
      tenantId_channel_provider: {
        tenantId: tenant.id,
        channel: 'email',
        provider: 'resend',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      channel: 'email',
      provider: 'resend',
      configEncrypted: JSON.stringify({
        apiKey: process.env.RESEND_API_KEY || 'test-key',
      }),
      isDefault: true,
      isActive: true,
    },
  });

  const smsProvider = await prisma.channelProvider.upsert({
    where: {
      tenantId_channel_provider: {
        tenantId: tenant.id,
        channel: 'sms',
        provider: 'twilio',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      channel: 'sms',
      provider: 'twilio',
      configEncrypted: JSON.stringify({
        accountSid: process.env.TWILIO_ACCOUNT_SID || 'test-sid',
        authToken: process.env.TWILIO_AUTH_TOKEN || 'test-token',
        fromNumber: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
      }),
      isDefault: true,
      isActive: true,
    },
  });

  console.log(`✅ Channel providers created`);

  console.log('\n✨ Seed completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   Tenant: ${tenant.slug}`);
  console.log(`   API Key: ${keyPrefix}... (save the full key above)`);
  console.log(`   Test User: ${testUser.externalId}`);
  console.log(`   Rules: 2`);
  console.log(`   Event Types: ${eventTypes.length}`);
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
