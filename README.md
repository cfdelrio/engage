# ORKESTAI ENGAGE

**AI Real-Time Engagement OS** — plataforma SaaS B2B multi-tenant que recibe eventos en tiempo real, entiende el contexto del usuario y decide automáticamente si contactarlo, cuándo, por qué canal y con qué mensaje.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| API | Fastify 5 + TypeScript + Zod |
| ORM | Prisma + PostgreSQL 16 |
| Queues | BullMQ + Redis 7 |
| Frontend | Next.js 16 + Tailwind + shadcn/ui |
| AI | Anthropic Claude (provider-agnostic) |
| Infra local | Docker Compose |
| Infra cloud | AWS ECS Fargate |

---

## Estructura

```
engage/
├── apps/
│   ├── api/        # Fastify REST API + WebSocket
│   ├── web/        # Next.js admin dashboard
│   └── worker/     # BullMQ workers (event + delivery pipeline)
├── packages/
│   ├── core/          # Tipos, constantes, utilities compartidas
│   ├── database/      # Prisma schema + client + migrations + seed
│   ├── event-bus/     # Ingestion, deduplicación, queues BullMQ
│   ├── ai/            # AI orchestration layer (provider-agnostic)
│   ├── channels/      # Providers: email, SMS, push, voice
│   ├── rules-engine/  # Motor de reglas IF/THEN con DSL JSON
│   └── analytics/     # Engagement scoring + métricas
└── docker-compose.yml
```

---

## Inicio rápido

### Prerrequisitos

- Node.js ≥ 22
- pnpm ≥ 10
- Docker + Docker Compose

### Setup local

```bash
# 1. Instalar dependencias
pnpm install

# 2. Levantar infraestructura (Postgres + Redis + Bull Board)
docker compose up -d

# 3. Generar cliente Prisma
pnpm db:generate

# 4. Correr migraciones
pnpm db:migrate:dev

# 5. Seed: crea tenant ProdeCaballito + API key de demo
pnpm db:seed

# 6. Levantar todos los servicios en modo dev
pnpm dev
```

| Servicio | URL |
|----------|-----|
| API | http://localhost:3001 |
| Web dashboard | http://localhost:3000 |
| Swagger UI | http://localhost:3001/docs |
| Bull Board (queues) | http://localhost:3002 |

### Variables de entorno

Crear `.env` en la raíz:

```env
DATABASE_URL=postgresql://engage:engage@localhost:5432/engage
SHADOW_DATABASE_URL=postgresql://engage:engage@localhost:5433/engage_shadow
REDIS_URL=redis://localhost:6379

# Web → API (interno para SSR, evita hairpinning en EC2)
INTERNAL_API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# AI (opcional — usa mock provider si no está seteado)
ANTHROPIC_API_KEY=sk-ant-...

# Channels (opcional para desarrollo)
RESEND_API_KEY=re_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
FIREBASE_SERVICE_ACCOUNT_JSON='{...}'
```

---

## Arquitectura del pipeline

```
POST /v1/events  (API key auth)
  → Validar schema (EventDefinition lookup)
  → Deduplicar (Redis SET NX, TTL 24h por idempotencyKey)
  → Persistir Event en DB
  → Encolar → BullMQ: events.incoming
  → Responder 202 { eventId }

Worker: events.incoming
  → Cargar contexto de usuario (score, fatiga, preferencias, sesión)
  → Rules Engine (DSL JSON: AND/OR conditions → actions)
  → AI Layer (opcional, feature flag: ai_engagement_decisions)
  → Persistir EngagementDecision[]
  → Encolar → BullMQ: deliveries.scheduled

Worker: deliveries.scheduled
  → Verificar FrequencyCap
  → Verificar quiet hours (timezone-aware)
  → Verificar GlobalUnsubscribe
  → Renderizar template (Handlebars + variables del evento)
  → Rutear → queue por canal

Workers de canal (con retry + DLQ):
  deliveries.email     → Resend
  deliveries.sms       → Twilio SMS
  deliveries.push      → Firebase FCM
  deliveries.voice     → Twilio Voice + TTS
```

---

## API

Autenticación via header `x-api-key`.

```bash
# Ingestar un evento
curl -X POST http://localhost:3001/v1/events \
  -H "x-api-key: <tu-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "prode.ranking.changed",
    "userId": "user_123",
    "payload": { "newRank": 1, "previousRank": 4 }
  }'

# Respuesta: 202 { "eventId": "...", "status": "queued" }
```

Documentación completa en Swagger: `http://localhost:3001/docs`

### Endpoints principales

| Método | Path | Descripción |
|--------|------|-------------|
| `POST` | `/v1/events` | Ingestar evento |
| `POST` | `/v1/events/batch` | Ingestar lote de eventos |
| `GET` | `/v1/users` | Listar usuarios del tenant |
| `GET` | `/v1/users/:id/engagement` | Score y métricas de un usuario |
| `GET/POST` | `/v1/campaigns` | Gestión de campañas |
| `GET/POST` | `/v1/rules` | Gestión de reglas |
| `GET` | `/v1/analytics/overview` | Métricas generales |
| `GET` | `/v1/deliveries` | Historial de entregas |
| `WS` | `/v1/events/stream` | Stream en tiempo real |
| `POST` | `/webhooks/resend` | Webhook Resend (status email) |
| `POST` | `/webhooks/twilio` | Webhook Twilio (status SMS/voice) |

---

## Rules Engine

Las reglas se definen con un DSL JSON:

```json
{
  "conditions": {
    "operator": "AND",
    "conditions": [
      { "field": "event.type", "operator": "eq", "value": "prode.ranking.changed" },
      { "field": "event.payload.newRank", "operator": "lte", "value": 3 }
    ]
  },
  "actions": [
    { "type": "SEND_NOTIFICATION", "params": { "channel": "push", "priority": "high" } }
  ]
}
```

Operadores soportados: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `contains`, `changed`, `exists`

Acciones: `SEND_NOTIFICATION`, `ADD_TO_CAMPAIGN`, `SUPPRESS`, `ESCALATE`, `UPDATE_SCORE`

---

## AI Layer

El AI layer es **advisory** — el engine determinístico tiene la última palabra. La AI nunca puede bypasear unsubscribes, quiet hours o frequency caps.

El sistema es **provider-agnostic**: por defecto usa Claude (Anthropic), pero soporta OpenAI, Gemini, Mistral u Ollama como drop-in replacements, seleccionables por tenant o feature flag en runtime.

Para activar AI decisions en un tenant (vía Redis):

```bash
redis-cli SET "ff:ai_engagement_decisions:<tenantId>" "1"
```

Configuración AI por tenant en `Tenant.settings`:

```json
{
  "aiConfig": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-6",
    "temperature": 0.3,
    "toneInstructions": "Tono futbolero argentino, apasionado",
    "enabled": true
  }
}
```

---

## Multi-tenancy

Toda la plataforma es multi-tenant desde la base. Cada request es autenticado con una API key hasheada (SHA-256 — el raw key nunca se almacena). El primer tenant de demo es **ProdeCaballito** (`slug: prodecaballito`), creado por el seed.

La API key generada se imprime en stdout durante el seed.

---

## Comandos

```bash
pnpm dev              # Dev mode (todos los servicios en paralelo)
pnpm build            # Build de producción
pnpm typecheck        # TypeScript check
pnpm test             # Tests
pnpm lint             # ESLint

pnpm db:generate      # Regenerar Prisma client
pnpm db:migrate:dev   # Nueva migración en dev
pnpm db:seed          # Seed con datos de ProdeCaballito
```

---

## CI/CD

GitHub Actions con 4 jobs: `Typecheck → Lint → Test → Build`.

Deploy automático a AWS ECS Fargate al hacer push a `main` (requiere secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ACCOUNT_ID`, `DATABASE_URL`).

---

## Licencia

Privado — ORKESTAI © 2026
