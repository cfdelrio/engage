# Contributing to ORKESTAI ENGAGE

Guía para contribuyentes y desarrolladores.

---

## Principios

1. **Type Safety** — TypeScript en todo. No `any` sin justificación.
2. **Simplicity** — Código simple antes que código clever.
3. **Multi-tenancy First** — Todos los datos deben estar aislados por `tenantId`.
4. **API Key Auth** — No usar sesiones directas; todos los requests deben tener `x-api-key`.
5. **DRY en lógica, repetición en tests** — No extraer helper si se usa una sola vez.

---

## Setup para Contribuyentes

```bash
# 1. Fork + clone
git clone https://github.com/your-username/engage.git
cd engage

# 2. Crear rama de feature
git checkout -b feature/description
# o: git checkout claude/event-driven-engagement-platform-Bl7PI

# 3. Setup local
pnpm install
docker compose up -d
pnpm db:generate && pnpm db:migrate:dev && pnpm db:seed

# 4. Dev
pnpm dev

# 5. Cambiar código...

# 6. Verificar calidad
pnpm typecheck
pnpm lint
pnpm test  # cuando existan tests

# 7. Commit + push
git add .
git commit -m "feat: descripción clara"
git push -u origin feature/description

# 8. Crear PR en GitHub
```

---

## Estándares de Código

### Naming

```typescript
// ✅ CORRECTO
const userEngagementScore = 0.8;
interface VoiceCallPayload { ... }
function validatePhoneNumber(phone: string): boolean { ... }
const VOICE_CAMPAIGN_RETRY_DELAYS = [1, 5, 30]; // CONSTANTES_EN_MAYUS

// ❌ INCORRECTO
const score = 0.8;  // Muy vago
interface VCP { ... }  // Abreviaciones
function validate(p) { ... }  // Parámetros vagas
const retrys = [...];  // Typo + lowercase
```

### Imports

```typescript
// ✅ CORRECTO
import { type DeepPartial } from 'type-fest';
import { VoiceCall, type VoiceCallPayload } from '@engage/database';
import { logger } from '@engage/core/utils';

// ❌ INCORRECTO
import type * from 'type-fest';
import * as db from '@engage/database';  // Evitar * imports en app code
import { logger as l } from '@engage/core/utils';  // Renaming innecesario
```

### Error Handling

```typescript
// ✅ CORRECTO
try {
  const call = await twilio.calls.create({ ... });
  await db.voiceCall.update({ data: { twilioCallSid: call.sid } });
} catch (err) {
  logger.error(`[voice-calls] Failed: ${err}`);
  if (attempt < MAX_RETRIES) {
    throw new Error(`Retryable: ${err}`);
  }
  // Mark as failed in DB
}

// ❌ INCORRECTO
try {
  // ...
} catch (err) {
  console.log('Error occurred');  // Vago
  throw err;  // Re-throw sin contexto
}
```

### Functions

```typescript
// ✅ CORRECTO
async function processVoiceCall(job: Job<VoiceCallJob>): Promise<void> {
  const { voiceCallId, userId } = job.data;
  // ...
}

// ❌ INCORRECTO
async function process(j: any) {  // any type
  // ...
}

// ✅ CORRECTO: Mantener funciones pequeñas (<50 líneas)
// Si una función es >100 líneas, dividir en helpers

// ✅ CORRECTO: Nombres verbales
function validateEmail(email: string): boolean { ... }
function fetchUserContext(userId: string): Promise<User> { ... }
function generateTwiML(script: string): string { ... }

// ❌ INCORRECTO
function email_validation() { ... }  // snake_case en función
function user_context() { ... }  // Nombre vago
```

### Comments

```typescript
// ✅ CORRECTO: Solo comenta el POR QUÉ, no el QUÉ
// Retry con exponential backoff porque Twilio puede fallar por rate limits
const delayMs = attempt === 0 ? 60000 : attempt === 1 ? 300000 : 1800000;

// ❌ INCORRECTO
// Este es un delay
const delayMs = 60000;

// ❌ INCORRECTO: Multi-line docstrings
/**
 * This function processes a voice call job.
 * It takes a job and processes it.
 * Returns nothing.
 */
async function processVoiceCall(job) { ... }

// ✅ CORRECTO: Sin docstrings si el nombre es claro
async function processVoiceCall(job: Job<VoiceCallJob>): Promise<void> { ... }
```

### Database

```typescript
// ✅ CORRECTO: Siempre filtrar por tenantId
const user = await db.user.findFirst({
  where: { id, tenantId }  // ← tenantId SIEMPRE
});

// ❌ INCORRECTO
const user = await db.user.findUnique({
  where: { id }  // Puede exponer datos de otros tenants
});

// ✅ CORRECTO: Usar transacciones para operaciones críticas
await db.$transaction(async (tx) => {
  const voiceCall = await tx.voiceCall.create({ ... });
  await tx.voiceInteraction.create({ ... });
});

// ✅ CORRECTO: Especificar qué campos necesitas
const user = await db.user.findFirst({
  where: { id, tenantId },
  select: { id, externalId, email, phone, metadata: true }
});

// ❌ INCORRECTO: Traer todo (select implícito)
const user = await db.user.findFirst({ where: { id, tenantId } });
```

### Testing

**Nota:** Tests se harán en iteración posterior. Este es el estándar cuando existan.

```typescript
// ✅ CORRECTO: Describe lo que hace, no cómo lo hace
describe('VoiceCallProcessor', () => {
  it('calls Twilio API with correct TwiML when processing valid job', async () => {
    const job = createMockJob({ phone: '+5491234567890' });
    await processor.handle(job);
    
    expect(mockTwilio.calls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+5491234567890',
        twiml: expect.stringContaining('<Say>')
      })
    );
  });

  it('retries with exponential backoff on transient failure', async () => {
    // ...
  });
});

// ❌ INCORRECTO
describe('test', () => {
  it('works', async () => {
    // ...
  });
});
```

---

## Git Workflow

### Branch Naming

```
feature/voice-campaigns-dtmf
fix/webhook-signature-verification
docs/voice-campaigns-guide
refactor/rules-engine-evaluation
chore/upgrade-dependencies
```

### Commit Messages

```
feat: add DTMF response handling to voice campaigns
^ Tipo (feat, fix, docs, refactor, chore)

fix: resolve webhook signature verification for Twilio calls
docs: update VOICE_CAMPAIGNS.md with DTMF examples
refactor: extract renderScript into separate utility function
chore: upgrade typescript to latest minor
test: add unit tests for VoiceGenerator sentiment analysis

# Multi-line format (preferred para cambios grandes):
feat: implement voice campaign sentiment analysis

- Add VoiceGenerator.analyzeSentiment() method
- Integrate with Claude API for classification
- Store sentiment in VoiceCall records
- Add metrics aggregation by sentiment

Closes #123  # Si arregla issue
```

### Code Review Checklist

Antes de hacer PR:

- [ ] `pnpm typecheck` pasa sin errores
- [ ] `pnpm lint` pasa (o arreglaste warnings)
- [ ] Código es legible y sigue estándares
- [ ] Cambios están limitados al scope del feature
- [ ] No hay `console.log` (usar logger)
- [ ] No hay `any` types sin justificación
- [ ] Todos los new endpoints tienen `tenantId` en where clause
- [ ] Cambios a Prisma schema incluyen migration
- [ ] PR description explica QUÉ y POR QUÉ

---

## Project Structure

### Agregar Nuevo Package

```
# 1. Crear directorio
mkdir packages/my-package
cd packages/my-package

# 2. Crear package.json
cat > package.json << 'EOF'
{
  "name": "@engage/my-package",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@engage/core": "workspace:*",
    "@engage/database": "workspace:*"
  },
  "devDependencies": {
    "typescript": "workspace:*"
  }
}
EOF

# 3. Crear src/index.ts
mkdir src
touch src/index.ts

# 4. Root pnpm install automáticamente detecta el nuevo package
pnpm install

# 5. Actualizar tsconfig.base.json
# Agregar path mapping: "@engage/my-package": ["packages/my-package/src"]
```

### Agregar Nuevo Endpoint

```typescript
// 1. En apps/api/src/routes/new-feature.ts
const newFeatureRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticateApiKey);
  
  // Schemas
  const createSchema = z.object({
    name: z.string().min(1),
    // ...
  });
  
  // Routes
  fastify.get('/', async (request, reply) => {
    const items = await fastify.prisma.newItem.findMany({
      where: { tenantId: request.tenantId }  // ← IMPORTANTE
    });
    return items;
  });
  
  fastify.post('/', async (request, reply) => {
    const body = createSchema.parse(request.body);
    const item = await fastify.prisma.newItem.create({
      data: { ...body, tenantId: request.tenantId }
    });
    return reply.status(201).send(item);
  });
};

export default newFeatureRoutes;

// 2. En apps/api/src/app.ts, registrar ruta
await fastify.register(newFeatureRoutes, { prefix: '/v1/new-feature' });

// 3. Endpoint disponible en:
// GET  /v1/new-feature
// POST /v1/new-feature
```

---

## Feature Flags

Cómo agregar feature flag:

```typescript
// 1. En packages/core/src/constants/feature-flags.ts
export const FEATURE_FLAGS = {
  // ...
  MY_NEW_FEATURE: 'my_new_feature',
} as const;

// 2. En tu código
import { FEATURE_FLAGS } from '@engage/core/constants';
import { getFeatureFlag } from '@engage/core/utils/feature-flags';

const enabled = await getFeatureFlag(
  FEATURE_FLAGS.MY_NEW_FEATURE,
  tenantId
);

if (enabled) {
  // Lógica de feature
}

// 3. Activar para tenant específico
// redis-cli SET "ff:my_new_feature:<tenantId>" "1"

// 4. Activar globalmente
// redis-cli SET "ff:my_new_feature" "1"
```

---

## Debugging

### Logger

```typescript
import { logger } from '@engage/core/utils';

logger.info(`[voice-calls] Processing call ${voiceCallId}`);
logger.warn(`[voice-calls] Retry attempt ${attempt}`);
logger.error(`[voice-calls] Failed: ${err.message}`);
```

### Database

```bash
# Acceder a DB
psql postgresql://engage:engage@localhost:5432/engage

# Ver eventos recientes
SELECT id, type, userId, status, createdAt 
FROM "Event" 
ORDER BY createdAt DESC LIMIT 10;

# Ver voice calls
SELECT id, twilioCallSid, status, duration, sentiment 
FROM "VoiceCall" 
ORDER BY createdAt DESC LIMIT 10;

# Ver jobs en queue (Redis)
redis-cli

# Ver todas las keys
KEYS *

# Ver jobs pendientes
LRANGE bull:voice.calls:${job-id} 0 -1
```

### Monitoring Queues

1. Abrir http://localhost:3002 (Bull Board)
2. Ver jobs activos, completados, fallidos
3. Retry jobs fallidos manualmente

---

## Performance

### Índices en Prisma

```prisma
model VoiceCall {
  id          String @id @default(cuid())
  voiceCampaignId String
  tenantId    String
  status      String
  createdAt   DateTime @default(now())
  
  // Índices para queries comunes
  @@index([tenantId, status])        // Filtros típicos
  @@index([tenantId, createdAt])     // Paginación
  @@index([twilioCallSid])           // Lookup por CallSid
  
  // Unique constraint
  @@unique([twilioCallSid])
}
```

### N+1 Query Prevention

```typescript
// ❌ INCORRECTO: N+1 queries
const calls = await db.voiceCall.findMany({ where: { campaignId } });
for (const call of calls) {
  const campaign = await db.voiceCampaign.findUnique({ where: { id: call.campaignId } });
  // ...
}

// ✅ CORRECTO: Include relacionados
const calls = await db.voiceCall.findMany({
  where: { campaignId },
  include: { campaign: true }  // Eager load
});
```

---

## Deployment Considerations

### Environment Variables

Nunca committear secrets. Usar `.env.local` (en .gitignore):

```env
ANTHROPIC_API_KEY=sk-ant-...
TWILIO_AUTH_TOKEN=...
```

En producción, usar AWS Secrets Manager o env vars.

### Database Migrations

```bash
# Crear nueva migración
pnpm db:migrate:dev --name add_voice_sentiment

# Aplicar a producción
# (via CI/CD, nunca manual)

# Rollback (si necesario)
prisma migrate resolve --rolled-back <name>
```

### Zero-Downtime Deploy

- ✅ Agregar columnas
- ✅ Agregar índices
- ✅ Cambiar defaults
- ❌ Eliminar columnas (en el mismo deploy)
- ❌ Cambiar tipos (en el mismo deploy)
- ❌ Renombrar columnas

Regla: cambios a schema se hacen en deploy anterior al código que los usa.

---

## Troubleshooting Desarrollo

### Módulos no encontrados

```bash
pnpm install
pnpm db:generate
pnpm typecheck
```

### Port ya en uso

```bash
# Ver qué está usando puerto 3001
lsof -i :3001

# Matar proceso
kill -9 <PID>
```

### Redis no conecta

```bash
redis-cli PING
# Si no responde PONG:
docker compose restart redis
docker compose logs -f redis
```

### Cambios no se reflejan

```bash
# Limpiar caché
rm -rf .turbo
rm -rf node_modules/.turbo

# Regenerar
pnpm install
pnpm db:generate
```

---

## Preguntas Frecuentes

**¿Cómo agrego una nueva tabla Prisma?**
1. Editar `packages/database/prisma/schema.prisma`
2. `pnpm db:migrate:dev --name add_my_table`
3. `pnpm db:generate`
4. Listo

**¿Cómo debuggeo un webhook?**
1. Usar ngrok para tunneling (en dev): `ngrok http 3001`
2. Usar webhook.site para capturar requests
3. O agregar log en endpoint: `logger.info(JSON.stringify(request.body))`

**¿Por qué mis changes no aparecen?**
1. ¿Guardaste el archivo?
2. ¿Turbo está recompilando? (`pnpm dev`)
3. ¿Hay error de TypeScript? (`pnpm typecheck`)

**¿Puedo hacer push sin tests?**
Sí, tests son iteración posterior. Pero `typecheck` y `lint` deben pasar.

---

## Contacto

- **Preguntas técnicas:** Abre issue en GitHub
- **PRs y reviews:** Pedir review en #engineering Slack
- **Onboarding:** Ver [GETTING_STARTED.md](/GETTING_STARTED.md)

¡Gracias por contribuir! 🙌
