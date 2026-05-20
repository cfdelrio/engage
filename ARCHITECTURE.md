# Arquitectura de ORKESTAI ENGAGE

## Visión General

```
┌─────────────────────────────────────────────────────────────────┐
│                         ORKESTAI ENGAGE                         │
│            AI Real-Time Engagement Operating System             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌──────────────────────────────────────┐
│   Evento API    │         │     Web Dashboard (Next.js)          │
│   (Fastify)     │────────▶│  • Campaña builder (AI suggestions)  │
│                 │         │  • Rules engine visual               │
│ • Validación    │         │  • Analytics real-time               │
│ • Deduplicación │         │  • User engagement profiles          │
│ • Autenticación │         │  • Settings, API keys, channels      │
└────────┬────────┘         └──────────────────────────────────────┘
         │
         │ Event
         ▼
    ┌────────────────────────────────────────────┐
    │           BullMQ Job Queues (Redis)         │
    │  • events.incoming       (Event processor)  │
    │  • deliveries.scheduled  (Delivery router)  │
    │  • deliveries.email                         │
    │  • deliveries.sms                           │
    │  • deliveries.push                          │
    │  • voice.calls           (Voice Campaign)   │
    │  • DLQ (failed jobs)                        │
    └────────────────────────────────────────────┘
         │
         │ Events
         ▼
    ┌────────────────────────────────────────────┐
    │              Workers (Node.js)              │
    │  • Event Processor                          │
    │    - Rules Engine evaluation                │
    │    - AI consultation (optional)             │
    │    - EngagementDecisions creation           │
    │  • Delivery Scheduler                       │
    │    - Quiet hours check                      │
    │    - Unsubscribe check                      │
    │    - Frequency cap check                    │
    │  • Channel Workers                          │
    │    - Email (Resend)                         │
    │    - SMS (Twilio)                           │
    │    - Push (Firebase FCM)                    │
    │    - Voice (Twilio Voice + TwiML)           │
    └────────────────────────────────────────────┘
         │
         │ Delivery
         ▼
    ┌────────────────────────────────────────────┐
    │         External Providers                  │
    │  • Resend (email)                           │
    │  • Twilio (SMS, Voice)                      │
    │  • Firebase FCM (push)                      │
    │  • Claude API (AI)                          │
    └────────────────────────────────────────────┘
         │
         │ Status Webhooks
         ▼
    ┌────────────────────────────────────────────┐
    │       Webhook Handlers (Fastify)            │
    │  • POST /webhooks/resend                    │
    │  • POST /webhooks/twilio                    │
    │  • POST /webhooks/twilio/voice              │
    │  • POST /webhooks/twilio/gather (DTMF)      │
    │  • POST /webhooks/twilio/recording          │
    └────────────────────────────────────────────┘
         │
         │ Status Updates
         ▼
    ┌────────────────────────────────────────────┐
    │       PostgreSQL Database                   │
    │  • Events, Deliveries, VoiceCalls           │
    │  • Rules, Campaigns, Templates              │
    │  • Users, Preferences, EngagementScores     │
    │  • Audit logs, Metrics                      │
    └────────────────────────────────────────────┘
```

---

## Core Packages

### `packages/core`
Tipos, constantes y utilidades compartidas.

**Archivos clave:**
- `types/index.ts` — Tipos principales (Event, User, Delivery, etc.)
- `types/rules.ts` — DSL para reglas (ConditionGroup, Condition, RuleAction)
- `constants/queues.ts` — Nombres de queues BullMQ
- `constants/feature-flags.ts` — Feature flags globales
- `utils/quiet-hours.ts` — Lógica de quiet hours timezone-aware
- `utils/frequency-caps.ts` — Validación de frequency caps

---

### `packages/database`
Prisma ORM + schema + migrations + seed.

**Schema entities:**
- `Tenant` — Multi-tenancy
- `User`, `UserPreference`, `UserEngagementScore`, `UserSession`
- `Event`, `EventDefinition`, `EventProcessingLog`
- `EngagementDecision`, `Campaign`, `CampaignRun`
- `Delivery`, `DeliveryEvent`
- `Template`, `Rule`, `RuleExecution`
- `ChannelProvider`, `GlobalUnsubscribe`, `FrequencyCap`
- `VoiceCampaign`, `VoiceCall`, `VoiceInteraction`, `VoiceMetric` ⭐
- `EngagementMetric`, `AIDecisionMetric`
- `AuditLog`

**Comandos:**
```bash
pnpm db:generate      # Regenerar Prisma client
pnpm db:migrate:dev   # Nueva migración
pnpm db:push          # Push a DB remoto (prod)
pnpm db:seed          # Seed con datos de ProdeCaballito
```

---

### `packages/event-bus`
Ingestion, deduplicación, processing, replay.

**Arquitectura:**
```typescript
// Event ingestion pipeline
export class EventBusService {
  async ingestEvent(req: IngestEventRequest): Promise<IngestEventResponse> {
    // 1. Validate schema
    // 2. Deduplicate (Redis SET NX)
    // 3. Persist Event
    // 4. Enqueue to BullMQ: events.incoming
    // 5. Return 202 { eventId }
  }

  async replayEvents(filter: ReplayFilter): Promise<number> {
    // Replay historical events for reprocessing
  }
}
```

**Endpoints:**
- `POST /v1/events` → Ingestar un evento
- `POST /v1/events/batch` → Batch ingestion

---

### `packages/rules-engine`
Motor IF/THEN con DSL JSON.

**Arquitectura:**
```typescript
export class RulesEngine {
  // Evalúa condiciones JSON complejas
  evaluate(conditions: ConditionGroup, context: EvaluationContext): boolean
  
  // Ejecuta acciones si las condiciones matchean
  execute(rule: Rule, context: ExecutionContext): Promise<void>
}

// Acciones soportadas
type RuleActionType = 
  | 'SEND_NOTIFICATION'      // Email, SMS, push
  | 'START_VOICE_CAMPAIGN'   // Voice calls ⭐
  | 'ADD_TO_CAMPAIGN'        // Agregar a otra campaña
  | 'SUPPRESS'               // No contactar
  | 'ESCALATE'               // Subir prioridad
  | 'UPDATE_SCORE'           // Actualizar engagement score
```

**Ejemplo de rule DSL:**
```json
{
  "conditions": {
    "operator": "AND",
    "conditions": [
      { "field": "event.type", "operator": "eq", "value": "user.inactive_7d" },
      { "field": "user.fatigueScore", "operator": "lt", "value": 0.6 }
    ]
  },
  "actions": [
    {
      "type": "START_VOICE_CAMPAIGN",
      "params": {
        "campaignId": "camp_reactivation",
        "audienceFilter": { "field": "user.daysInactive", "operator": "gte", "value": 7 }
      }
    }
  ]
}
```

---

### `packages/ai`
AI orchestration layer (provider-agnostic).

**Arquitectura:**
```typescript
// Interfaz abstracta
interface AIProvider {
  name: string;
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
  isAvailable(): Promise<boolean>;
}

// Providers concretos
class AnthropicProvider implements AIProvider { /* Claude Sonnet */ }
class OpenAIProvider implements AIProvider { /* GPT-4o */ }
class MockAIProvider implements AIProvider { /* Testing */ }

// Registry (resolución dinámica por tenant + feature flag)
class AIProviderRegistry {
  resolve(tenantId: string): AIProvider
}

// Orquestador (no conoce provider concreto)
class AIOrchestrationLayer {
  consultForDecision(context): Promise<AIDecision>
  generateCopy(context): Promise<CopyVariants>
  analyzeSentiment(text): Promise<SentimentAnalysis> ⭐
  generateEmotionalTone(script, emotion): Promise<string> ⭐
}
```

**Voice-specific:**
```typescript
export class VoiceGenerator {
  async analyzeSentiment(req: SentimentAnalysisRequest): Promise<SentimentAnalysisResponse>
  async generateVoiceDescription(req): Promise<string>
  async generateEmotionalTone(script, emotion): Promise<string>
}
```

---

### `packages/channels`
Channel providers (interfaz abstracta + implementaciones).

**Interfaz:**
```typescript
interface ChannelProvider {
  channel: 'email' | 'sms' | 'push' | 'whatsapp' | 'voice';
  send(payload: DeliveryPayload): Promise<ProviderResult>;
  validateConfig(config): Promise<boolean>;
  parseWebhook(body, headers): DeliveryEvent[];
}
```

**Providers implementados:**
- `ResendEmailProvider` — Email transaccional
- `TwilioSMSProvider` — SMS
- `FirebasePushProvider` — Push notifications
- `TwilioWhatsAppProvider` — WhatsApp
- `TwilioVoiceProvider` — Voice calls con TwiML ⭐

**Voice Provider:** [Ver VOICE_CAMPAIGNS.md](/VOICE_CAMPAIGNS.md#twilio-voice-provider)

---

### `packages/analytics`
Engagement scoring, métricas, cálculos.

```typescript
export class EngagementScoringService {
  // Recalcula score basado en:
  // - Delivery success rate
  // - Open rates (email)
  // - Click rates (email)
  // - Response rates (voice DTMF)
  // - Sentiment trends
  async recalculateUserScore(userId, tenantId): Promise<UserEngagementScore>
}

export class MetricsAggregator {
  // Agrega métricas diarias por:
  // - Channel (email, sms, voice)
  // - Event type
  // - Campaign ID
  async aggregateMetrics(date, tenantId): Promise<EngagementMetric[]>
}
```

---

## Apps

### `apps/api`
Fastify REST API + WebSocket.

**Estructura:**
```
api/src/
├── app.ts                  # Fastify setup
├── plugins/
│   ├── api-key-auth.ts     # API key authentication
│   ├── redis.ts            # Redis plugin
│   ├── bullmq.ts           # BullMQ queues
│   └── prisma.ts           # Prisma client
├── routes/
│   ├── events.ts           # POST /v1/events
│   ├── users.ts            # /v1/users/*
│   ├── campaigns.ts        # /v1/campaigns/*
│   ├── rules.ts            # /v1/rules/*
│   ├── analytics.ts        # /v1/analytics/*
│   ├── voice.ts            # /v1/voice-campaigns/* ⭐
│   ├── webhooks.ts         # POST /webhooks/*
│   └── admin.ts            # /admin/*
├── utils/
│   ├── auth.ts
│   ├── prisma.ts           # asJson(), asJsonNullable()
│   └── error-handler.ts
└── types/
    └── fastify.d.ts        # Type augmentation
```

**Middleware:**
- API Key authentication (SHA-256 hashed)
- Request logging
- CORS
- Rate limiting (future)
- Error handling + sentry integration (future)

---

### `apps/worker`
BullMQ workers para async job processing.

**Estructura:**
```
worker/src/
├── index.ts                # Entrypoint, crea workers
├── processors/
│   ├── event-processor.ts
│   │   • Rules engine evaluation
│   │   • AI consultation
│   │   • EngagementDecisions creation
│   │   • START_VOICE_CAMPAIGN action handling ⭐
│   │
│   ├── delivery-scheduler.ts
│   │   • FrequencyCap checks
│   │   • Quiet hours checks
│   │   • Unsubscribe checks
│   │   • Template rendering
│   │   • Channel routing
│   │
│   ├── email.ts            # Resend provider
│   ├── sms.ts              # Twilio SMS provider
│   ├── push.ts             # Firebase FCM provider
│   │
│   └── voice-calls.ts      # Twilio Voice provider ⭐
│       • Fetch VoiceCall, User context
│       • Render script (Handlebars)
│       • Generate TwiML
│       • Call Twilio API
│       • Retry logic (exponential backoff)
│       • Max retries handling
│
├── queues.ts               # Queue configuration
└── utils/
    ├── retry-handler.ts
    └── error-handler.ts
```

**Queues:**
- `events.incoming` → event-processor
- `deliveries.scheduled` → delivery-scheduler
- `deliveries.email` → email processor
- `deliveries.sms` → sms processor
- `deliveries.push` → push processor
- `voice.calls` → voice-calls processor ⭐
- `dlq` → Failed jobs

---

### `apps/web`
Next.js 16 admin dashboard.

**Estructura:**
```
web/src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   │
│   └── (dashboard)/
│       ├── layout.tsx       # Sidebar nav + auth check
│       ├── dashboard/page.tsx
│       ├── campaigns/page.tsx
│       ├── rules/page.tsx
│       ├── users/page.tsx
│       ├── channels/page.tsx
│       ├── analytics/page.tsx
│       │
│       ├── voice-campaigns/
│       │   ├── page.tsx              # List + builder ⭐
│       │   └── [id]/
│       │       └── page.tsx          # Details + metrics ⭐
│       │
│       ├── feeds/page.tsx
│       └── settings/page.tsx
│
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── badge.tsx
│   │   └── ...
│   │
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   │
│   └── features/
│       ├── RuleBuilder/    # Visual rule builder
│       ├── CampaignForm/
│       ├── AnalyticsChart/
│       └── LiveEventFeed/  # WebSocket real-time
│
└── hooks/
    ├── useAuth.ts
    ├── useApi.ts
    └── useWebSocket.ts
```

**Tech Stack:**
- Next.js 16 App Router
- Tailwind CSS + shadcn/ui
- React Query (data fetching)
- Zustand (state management)
- WebSocket (real-time events)
- Recharts (analytics)

---

## Voice Campaigns Architecture ⭐

Subsistema completo para llamadas telefónicas automatizadas.

### Flujo de Vida de una VoiceCampaign

```
1. CREATE (draft)
   POST /v1/voice-campaigns
   → Validar script, config
   → Crear VoiceCampaign record
   → status = 'draft'

2. START (draft → active)
   POST /v1/voice-campaigns/:id/start
   → Validar campaña
   → Buscar usuarios matching audienceFilter
   → Para cada usuario: crear VoiceCall record
   → Encolar jobs en voice.calls queue
   → status = 'active'

3. VOICE.CALLS WORKER
   Para cada job en queue:
   → Fetch VoiceCall, VoiceCampaign, User
   → Render script con Handlebars ({{user.firstName}}, etc.)
   → Get Twilio credentials from ChannelProvider
   → Generate TwiML (XML con Say, Gather, Record)
   → Call Twilio API
   → Update VoiceCall: twilioCallSid, status='ringing'
   → Retry en caso de fallo (1m, 5m, 30m)

4. TWILIO WEBHOOKS (incoming)
   POST /webhooks/twilio/voice (call status)
   POST /webhooks/twilio/gather (DTMF keys)
   POST /webhooks/twilio/recording (recording done)
   → Verificar signature de Twilio
   → Update VoiceCall status, duration, recording
   → Create VoiceInteraction audit records
   → Trigger callbacks si aplica

5. PAUSE/STOP
   POST /v1/voice-campaigns/:id/pause
   → status = 'paused'
   → Cancela jobs pending
   → Llamadas en progreso continúan

6. VIEW METRICS
   GET /v1/voice-campaigns/:id/metrics
   → Aggregate VoiceMetric data
   → Calculate sentiment distribution
   → Calculate DTMF response counts
```

### VoiceCall States

```
queued    → Job creado, espera a ser procesado
  ↓
ringing   → Twilio API llamó, teléfono sonando
  ↓
answered  → Usuario respondió → in_progress
  ↓
completed ← Llamada completada exitosamente
  ↓
failed    ← Error (network, invalid phone, max retries)
no_answer ← Teléfono sonó pero nadie contestó
busy      ← Línea ocupada
```

### TwiML Generation (generado dinámicamente)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES" voice="woman">
    Hola Juan, te echamos de menos!
  </Say>
  
  <Gather numDigits="1" 
          action="http://localhost:3001/webhooks/twilio/gather" 
          method="POST">
    <Say language="es-ES" voice="woman">
      Presione 1 para volver, 2 para no contactarme más
    </Say>
  </Gather>
  
  <Record 
    maxLength="120"
    recordingStatusCallback="http://localhost:3001/webhooks/twilio/recording"
    recordingStatusCallbackMethod="POST" />
</Response>
```

### Integración con Rules Engine

```json
{
  "type": "START_VOICE_CAMPAIGN",
  "params": {
    "campaignId": "camp_reactivation",
    "audienceFilter": {
      "operator": "AND",
      "conditions": [
        { "field": "user.daysInactive", "operator": "gte", "value": 7 },
        { "field": "user.fatigueScore", "operator": "lt", "value": 0.6 }
      ]
    }
  }
}
```

---

## Data Flow End-to-End

### Ejemplo: Evento → Regla → Voice Campaign → Llamadas

```
1. Event Ingestion
   POST /v1/events
   {
     "type": "user.inactive_7d",
     "userId": "user_123",
     "payload": { "daysInactive": 8 }
   }
   → Validar schema
   → Deduplicar (Redis)
   → Persistir Event
   → Enqueue events.incoming job

2. Event Processing (Worker)
   events.incoming processor:
   → Load user context (score=0.4, fatigueScore=0.5)
   → Evaluate rules (si exista rule para user.inactive_7d)
   → Rule matches: conditions ✓, fatigue < 0.6 ✓
   → Execute action: START_VOICE_CAMPAIGN
   → Buscar usuarios con daysInactive >= 7
   → Para user_123: crear VoiceCall record
   → Encolar job en voice.calls queue
   → Create EngagementDecision record (tipo: voice_campaign)
   → Create EventProcessingLog con voiceActionsCount: 1

3. Voice Calls Processing (Worker)
   voice.calls processor:
   → Fetch VoiceCall (id=vc_123)
   → Fetch VoiceCampaign (id=camp_reactivation)
   → Fetch User (firstName='Juan')
   → Render script: "Hola Juan, te echamos de menos!"
   → Generate TwiML
   → Call Twilio API
   → Update VoiceCall: twilioCallSid='CA1234...', status='ringing'
   → Log: "Call initiated: CA1234..."

4. Twilio Callbacks (incoming)
   POST /webhooks/twilio/voice?CallSid=CA1234...&CallStatus=answered
   → Verificar Twilio signature ✓
   → Buscar VoiceCall con twilioCallSid=CA1234...
   → Update: status='in_progress', answeredAt=now()
   → Create VoiceInteraction (type=call_status)

   [Usuario presiona 1 en DTMF]
   POST /webhooks/twilio/gather?Digits=1
   → Update VoiceCall: dtmfResponse='1'
   → Create VoiceInteraction (type=dtmf)
   → Si dtmfConfig.action='add_to_campaign': agregar usuario

   POST /webhooks/twilio/voice?CallStatus=completed&CallDuration=45
   → Update VoiceCall: status='completed', duration=45s
   → Create VoiceInteraction (type=call_status)
   → Trigger callback workflow si aplica

   POST /webhooks/twilio/recording?RecordingUrl=...
   → Update VoiceCall: recordingUrl, recordingDuration
   → Create VoiceInteraction (type=recording)
   → Si VOICE_SENTIMENT_ANALYSIS flag: analizar con AI

5. Analytics & Metrics
   Aggregate records:
   → VoiceMetric: +1 sent, +1 answered, +1 completed, avgDuration=45s
   → EngagementMetric: +1 delivered via voice channel
   → UserEngagementScore: recalcular con feedback de llamada
   → AIDecisionMetric: si AI fue consultada

6. Dashboard View
   GET /v1/voice-campaigns/camp_reactivation/metrics
   → Retorna stats agregadas: sent=100, answered=85, completed=80, failed=20
   → Sentiment: positive=50, neutral=25, negative=5
   → DTMF: {1: 50, 2: 15, *: 20}
```

---

## Multi-tenancy

Toda la plataforma es multi-tenant desde el día 1:

```typescript
// 1. API Key authentication
POST /v1/users
header: x-api-key: pk_test_xxxxx
↓
// 2. Resolver tenantId del API key
const apiKey = await db.tenantApiKey.findUnique({
  where: { keyHash: sha256(rawKey) }
});
const tenantId = apiKey.tenantId;
request.tenantId = tenantId;
↓
// 3. Todos los queries filtran por tenantId
const user = await db.user.findFirst({
  where: { id, tenantId }  // ← TenantId siempre
});
↓
// 4. Isolation garantizada
// Un tenant no puede ver datos de otro
```

**Configuración por tenant:** `Tenant.settings` (JSON)
```json
{
  "aiConfig": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-6",
    "enabled": true
  },
  "voiceConfig": {
    "language": "es-ES",
    "voice": "female"
  },
  "features": {
    "voice_campaigns": true,
    "ai_engagement_decisions": true
  }
}
```

---

## Feature Flags

Control de características en runtime:

```bash
# Por tenant (override global)
redis-cli SET "ff:voice_campaigns:<tenantId>" "1"

# Global (default para todos)
redis-cli SET "ff:voice_campaigns" "1"

# Orden de resolución
1. Tenant override
2. Global flag
3. Default value
```

**Flags definidos:**
- `ai_engagement_decisions` — Consultar AI para decisiones
- `voice_campaigns` — Habilitar voice campaigns
- `voice_ai_generation` — AI generación de scripts
- `voice_sentiment_analysis` — Análisis de sentimiento en calls
- `voice_transcription` — Speech-to-text transcription
- `event_replay` — Replay de eventos históricos
- `analytics_v2` — Nueva versión de analytics

---

## Infraestructura Local (Docker Compose)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: engage
      POSTGRES_USER: engage
      POSTGRES_PASSWORD: engage
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  postgres_shadow:
    image: postgres:16-alpine
    ports:
      - "5433:5432"
    environment:
      POSTGRES_DB: engage_shadow
      POSTGRES_USER: engage
      POSTGRES_PASSWORD: engage

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  bull-board:
    image: deadly0/bull-board
    ports:
      - "3002:3000"
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379

volumes:
  postgres_data:
  redis_data:
```

Levantar:
```bash
docker compose up -d
```

---

## Infraestructura Cloud (AWS)

```
┌─────────────────────────────────────────┐
│            Route 53 (DNS)                │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│     CloudFront (CDN)                     │
│     + WAF (rate limiting)                │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│       ALB (Application Load Balancer)    │
│       • Health checks                    │
│       • SSL/TLS termination              │
└────────┬────────────────────┬───────────┘
         │                    │
    ┌────▼────┐          ┌────▼────┐
    │ ECS      │          │ ECS      │
    │ (API)    │          │ (Web)    │
    │ 2-20     │          │ 2-10     │
    │ tasks    │          │ tasks    │
    └────┬────┘          └────┬────┘
         │
         │  ┌──────────────────┐
         │  │ ECS (Worker)     │
         │  │ 2-10 tasks       │
         │  └──────────────────┘
         │
         │
    ┌────▼──────────────────────┐
    │ RDS PostgreSQL 16          │
    │ • Multi-AZ failover        │
    │ • Read replicas (analytics)│
    └────┬───────────────────────┘
         │
    ┌────▼──────────────────────┐
    │ ElastiCache Redis 7        │
    │ • Multi-AZ failover        │
    │ • Cluster mode enabled     │
    └────────────────────────────┘

Secrets:
  AWS Secrets Manager
  • ANTHROPIC_API_KEY
  • TWILIO_ACCOUNT_SID
  • RESEND_API_KEY
  • DATABASE_URL (encrypted at rest)
  • REDIS_URL

Storage:
  S3 + CloudFront
  • Voice recordings
  • Email attachments
  • Static assets
```

---

## CI/CD Pipeline

GitHub Actions:

```
On: push to main
  ↓
[Typecheck] — pnpm typecheck
  ├─ Fail? → Block merge
  ↓
[Lint] — pnpm lint
  ├─ Fail? → Block merge (optionally auto-fix)
  ↓
[Test] — pnpm test
  ├─ Fail? → Block merge
  ↓
[Build] — pnpm build
  ├─ Fail? → Block merge
  ↓
[Docker Build] — Build images
  ├─ engage-api:latest
  ├─ engage-worker:latest
  ├─ engage-web:latest
  ↓
[ECR Push] — Push to AWS ECR
  ↓
[ECS Deploy] — Blue/Green deployment
  ├─ Canary traffic (10%)
  ├─ Monitor metrics
  ├─ Auto-rollback on errors
  ↓
[Health Check] — Verify endpoints
  ↓
✅ Deployment complete
```

---

## Consideraciones de Seguridad

| Aspecto | Implementación |
|--------|------------------|
| API Keys | SHA-256 hashed, raw key nunca almacenado |
| Config Encriptado | AES-256-GCM a nivel aplicación |
| Webhook Verification | Signature validation (Twilio, Resend) |
| Rate Limiting | 100 req/sec por tenant (future: Redis sliding window) |
| SQL Injection | Prisma ORM prepared statements |
| XSS | Next.js automatic escaping + CSP headers (future) |
| CSRF | Token validation en forms |
| Audit Logging | AuditLog table + CloudWatch |
| Secrets | AWS Secrets Manager, nunca en .env prod |
| TLS | SSL/TLS enforcement, HSTS header |
| Data Encryption | At-rest (RDS encryption) + in-transit (TLS) |

---

## Decisiones Arquitectónicas

| Decisión | Rationale |
|----------|-----------|
| BullMQ no SQS | Sub-ms latency para real-time. SQS = 1s min. |
| AI es advisory | Engine determinístico tiene última palabra. No bypasea unsubscribes. |
| Provider-agnostic | Interface abstracta. Claude default, pero OpenAI/Gemini/Ollama drop-in replacements. |
| Config encriptada en DB | AES-256-GCM. Dump no expone credenciales. |
| CUID2 para IDs | Time-sortable → mejor B-tree locality en tablas grandes. |
| Turborepo | Content-hashed cache → -60-80% CI time. |
| Prisma Shadow DB | Validate migrations en CI antes de prod. |
| Handlebars templates | Simple + type-safe. Mejor que Liquid o Mustache. |
| Twilio Voice + TwiML | Standard IVR. Alternative: Vonage, Plivo, pero Twilio domina. |

---

## Ver también

- [README.md](/README.md) — Intro rápido
- [VOICE_CAMPAIGNS.md](/VOICE_CAMPAIGNS.md) — Documentación detallada de voice
- [TEST_PLAN.md](/TEST_PLAN.md) — Strategy de testing
- [DEPLOYMENT.md](/infra/DEPLOYMENT.md) — Deploy a prod
