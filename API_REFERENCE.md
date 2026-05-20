# API Reference

Documentación completa de todos los endpoints REST de ORKESTAI ENGAGE.

**Base URL:** `http://localhost:3001` (local) o `https://api.orkestai.com` (prod)

**Autenticación:** Header `x-api-key` (requerido para todos excepto webhooks)

---

## Events

### POST /v1/events
Ingestar un evento individual.

**Headers:**
```
x-api-key: pk_test_...
Content-Type: application/json
```

**Body:**
```typescript
{
  type: string;                     // Requerido. Ej: "prode.ranking.changed"
  userId: string;                   // Requerido
  payload: Record<string, unknown>;  // JSON payload del evento
  metadata?: {
    source?: string;                // "api", "webhook", "internal"
    ipAddress?: string;
    userAgent?: string;
  };
  idempotencyKey?: string;           // Para deduplicación (24h TTL)
}
```

**Response:** 202 Accepted
```typescript
{
  eventId: string;
  status: "queued";
  createdAt: string;
}
```

**Errores:**
- `400` — Validación fallida (type o userId faltando)
- `409` — Evento duplicado (mismo idempotencyKey dentro de 24h)

---

### POST /v1/events/batch
Ingestar múltiples eventos.

**Body:**
```typescript
{
  events: Array<{
    type: string;
    userId: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  }>;
}
```

**Response:** 202 Accepted
```typescript
{
  eventIds: string[];
  totalQueued: number;
  totalDuplicated: number;
}
```

---

### GET /v1/events/:id
Obtener detalles de un evento.

**Response:** 200 OK
```typescript
{
  id: string;
  tenantId: string;
  type: string;
  userId: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: "queued" | "processing" | "processed" | "failed";
  processedAt?: string;
  createdAt: string;
}
```

---

## Users

### GET /v1/users
Listar usuarios del tenant.

**Query params:**
- `limit` (optional, default 50, max 200)
- `offset` (optional, default 0)
- `search` (optional) — Search by email or externalId

**Response:** 200 OK
```typescript
{
  users: Array<{
    id: string;
    externalId: string;
    email?: string;
    phone?: string;
    timezone: string;
    locale: string;
    tags: string[];
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  total: number;
}
```

---

### POST /v1/users
Crear o actualizar usuario (upsert).

**Body:**
```typescript
{
  externalId: string;               // Requerido, ID en tu sistema
  email?: string;
  phone?: string;
  timezone?: string;                // Default: "UTC"
  locale?: string;                  // Default: "en"
  tags?: string[];
  metadata?: Record<string, unknown>;
}
```

**Response:** 201 Created
```typescript
{
  id: string;
  externalId: string;
  email?: string;
  phone?: string;
  timezone: string;
  locale: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

---

### GET /v1/users/:id
Obtener usuario específico.

**Response:** 200 OK
```typescript
{
  id: string;
  externalId: string;
  email?: string;
  phone?: string;
  timezone: string;
  locale: string;
  tags: string[];
  metadata: Record<string, unknown>;
  engagementScore: {
    score: number;        // 0-100
    fatigueScore: number; // 0-1
  };
  preferences: UserPreference[];
  createdAt: string;
  updatedAt: string;
}
```

---

### GET /v1/users/:id/preferences
Obtener preferencias de usuario.

**Response:** 200 OK
```typescript
{
  preferences: Array<{
    id: string;
    channel: string;          // "email", "sms", "push", "voice"
    category: string;         // "marketing", "transactional", "all"
    enabled: boolean;
    quietHoursStart?: number; // 0-23
    quietHoursEnd?: number;   // 0-23
  }>;
}
```

---

### PUT /v1/users/:id/preferences
Actualizar preferencias de usuario.

**Body:**
```typescript
{
  preferences: Array<{
    channel: string;
    category?: string;        // Default: "all"
    enabled: boolean;
    quietHoursStart?: number;
    quietHoursEnd?: number;
  }>;
}
```

**Response:** 200 OK
```typescript
{
  updated: number;
  preferences: Array<UserPreference>;
}
```

---

### GET /v1/users/:id/engagement
Obtener score y métricas de engagement.

**Response:** 200 OK
```typescript
{
  score: {
    userId: string;
    score: number;              // 0-100
    fatigueScore: number;       // 0-1
    openRate30d: number;        // %
    clickRate30d: number;       // %
    lastCalculatedAt: string;
  };
  recentDeliveries: Array<{
    id: string;
    channel: string;
    status: string;
    sentAt?: string;
    deliveredAt?: string;
    openedAt?: string;
    clickedAt?: string;
  }>;
}
```

---

## Campaigns

### GET /v1/campaigns
Listar campañas.

**Query params:**
- `status` (optional) — "draft", "scheduled", "active", "paused", "completed"
- `limit` (optional, default 50)
- `offset` (optional, default 0)

**Response:** 200 OK
```typescript
{
  campaigns: Array<Campaign>;
  total: number;
}
```

---

### POST /v1/campaigns
Crear campaña.

**Body:**
```typescript
{
  name: string;
  description?: string;
  type: "email" | "sms" | "push" | "voice";
  trigger?: Record<string, unknown>;     // Event trigger
  rules?: Record<string, unknown>;       // Conditions
  channels?: string[];
  templateId?: string;
  aiConfig?: Record<string, unknown>;
}
```

**Response:** 201 Created
```typescript
{
  id: string;
  name: string;
  status: "draft";
  // ...
}
```

---

### GET /v1/campaigns/:id
Obtener detalles de campaña.

**Response:** 200 OK
```typescript
{
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  trigger?: Record<string, unknown>;
  rules?: Record<string, unknown>;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  };
  createdAt: string;
  updatedAt: string;
}
```

---

### PUT /v1/campaigns/:id
Actualizar campaña.

**Body:** Cualquier campo es opcional (partial update)

**Response:** 200 OK
```typescript
{
  id: string;
  // campos actualizados...
}
```

---

## Voice Campaigns ⭐

### GET /v1/voice-campaigns
Listar campañas de voz.

**Query params:**
- `status` (optional) — "draft", "scheduled", "active", "paused", "completed"
- `limit` (optional, default 50)
- `offset` (optional, default 0)

**Response:** 200 OK
```typescript
{
  campaigns: Array<{
    id: string;
    name: string;
    description?: string;
    status: string;
    stats: {
      sent: number;
      answered: number;
      completed: number;
      failed: number;
      avgDuration: number;
    };
    createdAt: string;
  }>;
  total: number;
}
```

---

### POST /v1/voice-campaigns
Crear campaña de voz.

**Body:**
```typescript
{
  name: string;                          // Requerido
  description?: string;
  script: string;                        // Requerido, permite Handlebars
  voiceConfig: {
    language: string;                    // "es-ES", "es-MX", "en-US"
    voice: "male" | "female";
  };
  recordingUrl?: string;                 // URL pre-grabación
  aiGenerated?: boolean;                 // Default: false
  aiInstructions?: string;               // Context para AI
  dtmfConfig?: {
    enabled: boolean;
    options: Array<{
      key: string;                       // "1"-"9", "*", "#"
      action: string;                    // "callback", "unsubscribe", etc.
      label: string;
    }>;
  };
  audienceFilter?: ConditionGroup;       // DSL JSON
  maxRetries?: number;                   // Default: 2
}
```

**Response:** 201 Created
```typescript
{
  id: string;
  status: "draft";
  name: string;
  script: string;
  voiceConfig: { ... };
  stats: {
    sent: 0,
    answered: 0,
    completed: 0,
    failed: 0,
    avgDuration: 0
  };
  createdAt: string;
}
```

---

### GET /v1/voice-campaigns/:id
Obtener detalles de campaña de voz.

**Response:** 200 OK
```typescript
{
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "paused" | "completed";
  script: string;
  voiceConfig: { language: string; voice: string };
  dtmfConfig?: { enabled: boolean; options: [...] };
  maxRetries: number;
  stats: {
    sent: number;
    answered: number;
    completed: number;
    failed: number;
    avgDuration: number;
  };
  createdAt: string;
  updatedAt: string;
}
```

---

### PUT /v1/voice-campaigns/:id
Actualizar campaña de voz (solo si draft o paused).

**Body:** Cualquier campo es opcional

**Response:** 200 OK

---

### DELETE /v1/voice-campaigns/:id
Eliminar campaña (solo si draft).

**Response:** 204 No Content

---

### POST /v1/voice-campaigns/:id/start
Iniciar campaña (draft → active).

**Body (optional):**
```typescript
{
  scheduledFor?: string;  // ISO 8601, null = inmediato
}
```

**Response:** 200 OK
```typescript
{
  id: string;
  status: "active";
  stats: {
    sent: 45;        // Usuarios que van a ser llamados
    answered: 0;
    completed: 0;
    failed: 0;
    avgDuration: 0;
  };
}
```

---

### POST /v1/voice-campaigns/:id/pause
Pausar campaña (active → paused).

**Response:** 200 OK
```typescript
{
  id: string;
  status: "paused";
}
```

---

### GET /v1/voice-campaigns/:id/calls
Listar llamadas de una campaña.

**Query params:**
- `status` (optional) — "queued", "ringing", "in_progress", "completed", "failed", "no_answer"
- `limit` (optional, default 50)
- `offset` (optional, default 0)

**Response:** 200 OK
```typescript
{
  calls: Array<{
    id: string;
    phone: string;
    status: string;
    duration?: number;
    sentiment?: string;           // "positive", "neutral", "negative"
    dtmfResponse?: string;        // Teclas presionadas
    recordingUrl?: string;        // S3 pre-signed URL
    completedAt?: string;
    createdAt: string;
  }>;
  total: number;
}
```

---

### GET /v1/voice-calls/:id
Obtener detalles de una llamada.

**Response:** 200 OK
```typescript
{
  id: string;
  voiceCampaignId: string;
  phone: string;
  status: string;
  duration?: number;
  recordingUrl?: string;
  recordingDuration?: number;
  sentiment?: string;
  transcription?: string;
  dtmfResponse?: string;
  dtmfAction?: string;
  terminationReason?: string;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: string;
  answeredAt?: string;
  completedAt?: string;
  createdAt: string;
  interactions: Array<{
    id: string;
    type: "dtmf" | "transcript" | "sentiment";
    data: Record<string, unknown>;
    timestamp: string;
  }>;
}
```

---

### POST /v1/voice-calls/:id/callback
Agendar callback automático.

**Body:**
```typescript
{
  scheduledFor: string;     // ISO 8601 datetime (requerido)
  reason?: string;          // "user_requested", "system_retry", etc.
}
```

**Response:** 201 Created
```typescript
{
  id: string;              // New VoiceCall ID
  phone: string;
  status: "queued";
  scheduledFor: string;
}
```

---

### GET /v1/voice-calls/:id/recording
Obtener URL pre-firmada para descargar grabación.

**Response:** 200 OK
```typescript
{
  url: string;                          // S3 pre-signed, válida 15 min
  duration: number;                     // segundos
  contentType: "audio/wav" | "audio/mp3";
}
```

---

### GET /v1/voice-campaigns/:id/metrics
Obtener métricas de campaña.

**Query params:**
- `granularity` (optional) — "hour" (default), "day", "week"
- `since` (optional) — ISO 8601, default últimas 24h

**Response:** 200 OK
```typescript
{
  campaignId: string;
  stats: {
    sent: number;
    answered: number;
    completed: number;
    failed: number;
    avgDuration: number;
    answerRate: number;        // % answered / sent
    completionRate: number;    // % completed / answered
  };
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  dtmf: {
    "1": number;
    "2": number;
    "3": number;
    // ...
  };
  timeline: Array<{
    timestamp: string;
    sent: number;
    answered: number;
    completed: number;
    failed: number;
  }>;
}
```

---

## Rules

### GET /v1/rules
Listar reglas.

**Response:** 200 OK
```typescript
{
  rules: Array<{
    id: string;
    name: string;
    enabled: boolean;
    priority: number;
    conditions: Record<string, unknown>;
    actions: Array<RuleAction>;
    createdAt: string;
  }>;
  total: number;
}
```

---

### POST /v1/rules
Crear regla.

**Body:**
```typescript
{
  name: string;
  enabled?: boolean;              // Default: true
  priority?: number;              // Default: 0
  conditions: ConditionGroup;     // DSL JSON
  actions: Array<{
    type: string;
    params: Record<string, unknown>;
  }>;
  cooldownSeconds?: number;       // Para no ejecutar múltiples veces
}
```

**Response:** 201 Created

---

### GET /v1/rules/:id
Obtener regla.

**Response:** 200 OK

---

### PUT /v1/rules/:id
Actualizar regla.

**Body:** Partial update

**Response:** 200 OK

---

### DELETE /v1/rules/:id
Eliminar regla.

**Response:** 204 No Content

---

## Analytics

### GET /v1/analytics/overview
Métricas generales del tenant.

**Query params:**
- `since` (optional) — ISO 8601, default últimos 30 días
- `granularity` (optional) — "day" (default), "hour", "week"

**Response:** 200 OK
```typescript
{
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failedCount: number;
  avgOpenRate: number;          // %
  avgClickRate: number;         // %
  timeline: Array<{
    date: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  }>;
  byChannel: {
    email: { sent, delivered, opened, clicked };
    sms: { sent, delivered, opened, clicked };
    push: { sent, delivered, opened, clicked };
    voice: { sent, answered, completed, failed };
  };
}
```

---

### GET /v1/analytics/channels
Análisis por canal.

**Response:** 200 OK
```typescript
{
  channels: Array<{
    channel: string;
    sent: number;
    delivered: number;
    opened?: number;
    clicked?: number;
    failureRate: number;     // %
  }>;
}
```

---

## Webhooks

### POST /webhooks/resend
Webhook de Resend (email status).

**No requiere autenticación. Verify Resend signature.**

**Body:**
```typescript
{
  type: string;     // "email.delivered", "email.opened", "email.clicked", etc.
  data: {
    email_id: string;
    // ...
  };
}
```

---

### POST /webhooks/twilio
Webhook de Twilio (SMS/voice legacy).

**No requiere autenticación. Verify Twilio signature.**

---

### POST /webhooks/twilio/voice
Webhook de Twilio (call status).

**No requiere autenticación. Verify Twilio signature.**

**Body:**
```typescript
{
  CallSid: string;
  CallStatus: "initiated" | "ringing" | "answered" | "completed" | "no-answer" | "busy" | "failed";
  CallDuration?: string;  // seconds
  // ...
}
```

---

### POST /webhooks/twilio/gather
Webhook de Twilio (DTMF response).

**Body:**
```typescript
{
  CallSid: string;
  Digits: string;  // "1", "2", "3", "*", "#", etc.
  // ...
}
```

---

### POST /webhooks/twilio/recording
Webhook de Twilio (recording completed).

**Body:**
```typescript
{
  CallSid: string;
  RecordingUrl: string;
  RecordingDuration: string;  // seconds
  // ...
}
```

---

## Admin

### GET /admin/tenant
Obtener configuración del tenant.

**Requires:** JWT auth o API key admin

**Response:** 200 OK
```typescript
{
  id: string;
  slug: string;
  name: string;
  plan: "starter" | "pro" | "enterprise";
  settings: {
    aiConfig: { provider, model, enabled };
    voiceConfig: { language, voice };
    features: { voice_campaigns, ai_engagement_decisions, ... };
  };
  createdAt: string;
}
```

---

### PUT /admin/tenant
Actualizar configuración del tenant.

**Body:** Partial update

**Response:** 200 OK

---

### GET /admin/api-keys
Listar API keys.

**Response:** 200 OK
```typescript
{
  keys: Array<{
    id: string;
    name: string;
    keyPrefix: string;      // Primeros 10 chars
    lastUsedAt?: string;
    createdAt: string;
  }>;
}
```

---

### POST /admin/api-keys
Crear nueva API key.

**Body:**
```typescript
{
  name: string;
}
```

**Response:** 201 Created
```typescript
{
  id: string;
  name: string;
  keyPrefix: string;
  key: string;              // ⚠️ Raw key solo se muestra una vez
}
```

---

### DELETE /admin/api-keys/:id
Eliminar API key.

**Response:** 204 No Content

---

## Error Codes

| Status | Code | Descripción |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Validación fallida |
| 401 | `UNAUTHORIZED` | API key inválida o expirada |
| 403 | `FORBIDDEN` | Insuficientes permisos |
| 404 | `NOT_FOUND` | Recurso no existe |
| 409 | `CONFLICT` | Duplicado (ej: evento duplicado) |
| 422 | `UNPROCESSABLE_ENTITY` | Entidad no procesable |
| 429 | `RATE_LIMITED` | Demasiadas requests |
| 500 | `INTERNAL_ERROR` | Error del servidor |

---

## Rate Limiting

- **Límite global:** 1000 requests/minuto por tenant
- **Límite de evento:** 100 eventos/segundo por tenant
- **Headers:**
  ```
  X-RateLimit-Limit: 1000
  X-RateLimit-Remaining: 999
  X-RateLimit-Reset: 1234567890
  ```

---

## Exemplos en cURL

### 1. Ingestar evento
```bash
curl -X POST http://localhost:3001/v1/events \
  -H "x-api-key: pk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "type": "prode.ranking.changed",
    "userId": "user_123",
    "payload": { "newRank": 1 }
  }'
```

### 2. Crear usuario
```bash
curl -X POST http://localhost:3001/v1/users \
  -H "x-api-key: pk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "user_123",
    "email": "user@example.com",
    "timezone": "America/Argentina/Buenos_Aires"
  }'
```

### 3. Crear campaña de voz
```bash
curl -X POST http://localhost:3001/v1/voice-campaigns \
  -H "x-api-key: pk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Reactivación",
    "script": "Hola {{user.firstName}}, te echamos de menos!",
    "voiceConfig": { "language": "es-ES", "voice": "female" }
  }'
```

### 4. Iniciar campaña
```bash
curl -X POST http://localhost:3001/v1/voice-campaigns/<id>/start \
  -H "x-api-key: pk_test_..."
```

### 5. Ver métricas
```bash
curl -X GET http://localhost:3001/v1/voice-campaigns/<id>/metrics \
  -H "x-api-key: pk_test_..."
```

---

## Swagger UI

Documentación interactiva disponible en:

```
http://localhost:3001/docs
```

Todos los endpoints pueden ser testeados directamente desde la UI.
