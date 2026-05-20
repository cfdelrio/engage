# Voice Campaigns - Documentación Completa

**Voice Campaigns** es un sistema para contactar usuarios vía llamadas telefónicas automatizadas, con soporte para:
- Mensajes de voz generados con IA o pre-grabados
- Respuestas DTMF (teclas presionables: 1, 2, 3...)
- Grabación automática de llamadas
- Análisis de sentimiento en tiempo real
- Workflows de callback automático
- Integración con Twilio Voice API + TwiML

---

## Inicio rápido

### 1. Crear una campaña

```bash
curl -X POST http://localhost:3001/v1/voice-campaigns \
  -H "x-api-key: <tu-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Reactivación de usuarios",
    "description": "Llamadas a usuarios inactivos hace 7+ días",
    "script": "Hola {{user.firstName}}, te echamos de menos! Presiona 1 para volver, 2 para no contactarme más.",
    "voiceConfig": {
      "language": "es-ES",
      "voice": "female"
    },
    "dtmfConfig": {
      "enabled": true,
      "options": [
        { "key": "1", "action": "add_to_campaign", "label": "Volver" },
        { "key": "2", "action": "unsubscribe", "label": "No contactarme" }
      ]
    },
    "maxRetries": 2,
    "audienceFilter": {
      "operator": "AND",
      "conditions": [
        { "field": "user.daysInactive", "operator": "gte", "value": 7 }
      ]
    }
  }'

# Respuesta:
# {
#   "id": "camp_...",
#   "status": "draft",
#   "name": "Reactivación de usuarios",
#   ...
# }
```

### 2. Iniciar campaña

```bash
curl -X POST http://localhost:3001/v1/voice-campaigns/<campaign-id>/start \
  -H "x-api-key: <tu-api-key>"

# Respuesta: { "status": "active", "scheduledFor": "2026-05-20T14:30:00Z" }
```

### 3. Monitorear progreso

```bash
curl -X GET http://localhost:3001/v1/voice-campaigns/<campaign-id>/metrics \
  -H "x-api-key: <tu-api-key>"

# Respuesta:
# {
#   "stats": {
#     "sent": 45,
#     "answered": 38,
#     "completed": 35,
#     "failed": 10,
#     "avgDuration": 42
#   },
#   "sentiment": {
#     "positive": 20,
#     "neutral": 10,
#     "negative": 5
#   }
# }
```

---

## API Endpoints

### Campañas

#### `GET /v1/voice-campaigns`
Listar todas las campañas del tenant.

**Query params:**
- `status` (optional): `draft`, `scheduled`, `active`, `paused`, `completed`
- `limit` (optional, default 50): Número de resultados
- `offset` (optional, default 0): Paginación

**Respuesta:** `VoiceCampaign[]`

---

#### `POST /v1/voice-campaigns`
Crear nueva campaña en estado `draft`.

**Body:**
```typescript
{
  name: string;                           // Requerido
  description?: string;
  script: string;                         // Requerido, puede usar Handlebars
  voiceConfig: {
    language: string;                     // "es-ES", "es-MX", "en-US"
    voice: "male" | "female";
  };
  recordingUrl?: string;                  // Si usas pre-grabación
  aiGenerated?: boolean;                  // default false
  aiInstructions?: string;                // Context para AI si aiGenerated=true
  dtmfConfig?: {
    enabled: boolean;
    options: Array<{
      key: string;                        // "1"-"9", "*", "#"
      action: string;                     // "callback", "unsubscribe", "add_to_campaign"
      label: string;                      // "Presione 1 para..."
    }>;
  };
  audienceFilter?: ConditionGroup;        // JSON DSL (AND/OR conditions)
  maxRetries?: number;                    // default 2
}
```

**Respuesta:** `{ id: string; status: "draft"; ... }`

---

#### `GET /v1/voice-campaigns/:id`
Obtener detalles de una campaña.

**Respuesta:**
```typescript
{
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: "draft" | "scheduled" | "active" | "paused" | "completed";
  script: string;
  voiceConfig: { language: string; voice: "male" | "female" };
  dtmfConfig?: { enabled: boolean; options: [...] };
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

#### `PUT /v1/voice-campaigns/:id`
Actualizar campaña (solo si `status` = `draft` o `paused`).

**Body:** Mismo que `POST`, pero todos los campos son opcionales.

**Validaciones:**
- No puede cambiar `status` directamente (usar endpoints `/start`, `/pause`)
- No puede actualizar campaña `active` (pausar primero)

---

#### `DELETE /v1/voice-campaigns/:id`
Eliminar campaña (solo si `status` = `draft`).

---

#### `POST /v1/voice-campaigns/:id/start`
Iniciar campaña: transición `draft` → `active`.

**Body (opcional):**
```typescript
{
  scheduledFor?: string;  // ISO 8601 datetime, si null = inmediato
}
```

**Qué sucede:**
1. Valida que `status` sea `draft`
2. Busca usuarios que matchean `audienceFilter`
3. Para cada usuario: crea `VoiceCall` record
4. Encola jobs en BullMQ queue `voice.calls`
5. Transiciona `status` a `active`
6. Retorna stats actualizados

---

#### `POST /v1/voice-campaigns/:id/pause`
Pausar campaña: transición `active` → `paused`.

**Qué sucede:**
1. Detiene nuevos jobs (marca pending jobs como cancelled)
2. No afecta llamadas en progreso
3. Transiciona `status` a `paused`
4. Puedo reanudar con `/start` después

---

### Llamadas

#### `GET /v1/voice-campaigns/:id/calls`
Listar todas las llamadas de una campaña.

**Query params:**
- `status` (optional): `queued`, `ringing`, `in_progress`, `completed`, `failed`, `no_answer`
- `limit` (optional): Paginación
- `offset` (optional): Offset

**Respuesta:**
```typescript
{
  calls: Array<{
    id: string;
    phone: string;           // E.164: +5491123456789
    status: string;
    duration?: number;       // segundos
    sentiment?: string;      // "positive", "neutral", "negative"
    dtmfResponse?: string;   // "1", "2", etc.
    recordingUrl?: string;   // S3 pre-signed URL
    completedAt?: string;
    createdAt: string;
  }>;
  total: number;
}
```

---

#### `GET /v1/voice-calls/:id`
Obtener detalles de una llamada específica.

**Respuesta:**
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
  metadata: Record<string, any>;
  startedAt?: string;
  answeredAt?: string;
  completedAt?: string;
  createdAt: string;
  interactions: Array<{
    id: string;
    type: "dtmf" | "transcript" | "sentiment" | "duration";
    data: Record<string, any>;
    timestamp: string;
  }>;
}
```

---

#### `POST /v1/voice-calls/:id/callback`
Agendar callback automático para esta llamada.

**Body:**
```typescript
{
  scheduledFor: string;     // ISO 8601 datetime
  reason?: string;          // "user_requested", "system_retry", etc.
}
```

**Qué sucede:**
1. Crea nuevo `VoiceCall` record con status `queued`
2. Encola job en `voice.calls` para el datetime indicado
3. Retorna el nuevo call ID

---

#### `GET /v1/voice-calls/:id/recording`
Obtener URL pre-firmada de S3 para descargar grabación.

**Respuesta:**
```typescript
{
  url: string;              // S3 pre-signed URL válida 15 minutos
  duration: number;         // segundos
  contentType: "audio/wav" | "audio/mp3";
}
```

---

### Métricas

#### `GET /v1/voice-campaigns/:id/metrics`
Obtener estadísticas en tiempo real de una campaña.

**Query params:**
- `granularity` (optional, default "hour"): `hour`, `day`, `week`
- `since` (optional): ISO 8601 datetime (default últimas 24h)

**Respuesta:**
```typescript
{
  campaignId: string;
  stats: {
    sent: number;
    answered: number;
    completed: number;
    failed: number;
    avgDuration: number;
    answerRate: number;      // %
    completionRate: number;  // %
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
    // ... etc
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

## Plantillas Handlebars

El script soporta **Handlebars** para personalización:

```handlebars
Hola {{user.firstName}},

Tu ranking actual es {{user.ranking}}.
Email: {{user.email}}
Teléfono: {{user.phone}}

{{#if user.metadata.isPremium}}
  ¡Gracias por ser miembro premium!
{{else}}
  Considera actualizar a premium.
{{/if}}

Presiona 1 para más información.
```

**Variables disponibles:**
- `{{user.firstName}}` — Extracto de `user.externalId` (primer segmento antes de "-")
- `{{user.email}}`
- `{{user.phone}}`
- `{{user.metadata.*}}` — Cualquier campo custom en `user.metadata` JSON

---

## Configuración DTMF

DTMF (Dual-Tone Multi-Frequency) permite que usuarios presionen teclas para interactuar:

```json
{
  "dtmfConfig": {
    "enabled": true,
    "options": [
      {
        "key": "1",
        "action": "add_to_campaign",
        "label": "Quiero participar",
        "params": { "campaignId": "camp_onboarding" }
      },
      {
        "key": "2",
        "action": "unsubscribe",
        "label": "No contactarme"
      },
      {
        "key": "3",
        "action": "callback",
        "label": "Llamarme después",
        "params": { "delayMinutes": 30 }
      },
      {
        "key": "*",
        "action": "repeat",
        "label": "Repetir mensaje"
      },
      {
        "key": "#",
        "action": "agent",
        "label": "Hablar con un agente"
      }
    ]
  }
}
```

**Acciones soportadas:**
- `unsubscribe` — Agrega a `GlobalUnsubscribe` para ese canal
- `add_to_campaign` — Agrega usuario a otra campaña automáticamente
- `callback` — Agenda otra llamada más tarde
- `repeat` — Repite el mensaje (máx 2 veces)
- `agent` — Transfiere a agente (requiere `agentPhoneNumber` en config)

---

## Webhooks de Twilio

Cuando se hacen llamadas, Twilio envía webhooks de estado. El sistema los procesa automáticamente en:

```
POST /webhooks/twilio/voice
POST /webhooks/twilio/gather
POST /webhooks/twilio/recording
```

### Flujo de estados

```
queued
  ↓
ringing
  ↓
answered (o no-answer / busy / failed)
  ↓
in_progress
  ↓
completed (o failed / no-answer / busy)
```

### Estados terminales

- **completed** — Llamada completada exitosamente
- **failed** — Error del sistema o usuario colgó abruptamente
- **no_answer** — Teléfono sonó pero nadie contestó
- **busy** — Línea ocupada

---

## Retry Logic

Si una llamada falla, el sistema reintenta automáticamente:

| Intento | Delay |
|---------|-------|
| 1er intento | Inmediato |
| Fallo → 2do intento | 1 minuto |
| Fallo → 3er intento | 5 minutos |
| Fallo → 4to intento | 30 minutos |
| Máx retries | Marca como `failed` |

Para cambiar `maxRetries`:

```bash
curl -X PUT http://localhost:3001/v1/voice-campaigns/<id> \
  -H "x-api-key: <key>" \
  -H "Content-Type: application/json" \
  -d '{ "maxRetries": 5 }'
```

---

## Quiet Hours

Las llamadas respetan **quiet hours** del usuario. Si el usuario tiene:

```json
{
  "quietHoursStart": 22,  // 10 PM
  "quietHoursEnd": 9      // 9 AM
}
```

Las llamadas se agendarán automáticamente para después de las 9 AM.

---

## Restricciones de Contacto

El sistema respeta varias capas de opt-out:

1. **GlobalUnsubscribe** — Usuario se unsubscribeó del canal
2. **UserPreference** — Usuario deshabilitó el canal (pero puede ser re-habilitado)
3. **QuietHours** — No llamar fuera de horarios
4. **FrequencyCap** — Máximo N llamadas por hora/día/semana

Ejemplo:

```bash
# Setear frecuency cap: máximo 3 llamadas por usuario por semana
curl -X PUT http://localhost:3001/v1/users/<userId>/preferences \
  -H "x-api-key: <key>" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "channel": "voice",
      "enabled": true,
      "quietHoursStart": 22,
      "quietHoursEnd": 9,
      "frequencyCap": {
        "maxCount": 3,
        "windowSeconds": 604800  // 1 semana
      }
    }
  ]'
```

---

## AI Voice Generation

Si `aiGenerated: true`, el script se pasa a Claude para enriquecimiento:

```bash
curl -X POST http://localhost:3001/v1/voice-campaigns \
  -H "x-api-key: <key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AI Voice Campaign",
    "script": "El usuario {{user.firstName}} no ha iniciado sesión en 7 días.",
    "aiGenerated": true,
    "aiInstructions": "Reescribe con tono cálido, amigable y sin presionar. Máx 45 segundos.",
    "voiceConfig": {
      "language": "es-ES",
      "voice": "female"
    }
  }'
```

La IA:
1. **Analiza sentimiento** del script
2. **Genera descripción de énfasis** (pausas, énfasis, velocidad)
3. **Reescribe adaptado** al tono del tenant

Feature flag: `VOICE_AI_GENERATION`

---

## Análisis de Sentimiento

Si `VOICE_SENTIMENT_ANALYSIS` está habilitado, el sistema analiza el sentimiento de cada llamada completada.

Los posibles valores son: `positive`, `neutral`, `negative`

**Datos disponibles después de la llamada:**
```typescript
{
  voiceCallId: string;
  sentiment: "positive" | "neutral" | "negative";
  confidence: number;  // 0-1
  reasoning: string;   // Explicación de por qué
}
```

En métricas:
```json
{
  "sentiment": {
    "positive": 20,
    "neutral": 15,
    "negative": 5
  }
}
```

---

## Integración con Rules Engine

Activa llamadas automáticamente basadas en eventos:

```json
{
  "name": "Reactivar usuarios inactivos",
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
        "audienceFilter": {
          "operator": "AND",
          "conditions": [
            { "field": "user.daysInactive", "operator": "gte", "value": 7 }
          ]
        }
      }
    }
  ]
}
```

---

## Variables de Entorno

Agregar a `.env`:

```env
# Twilio Voice Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Voice TTS Provider (opcional)
VOICE_TTS_PROVIDER=google          # google, aws-polly, elevenlabs
VOICE_LANGUAGE_CODE=es-ES
VOICE_GENDER=female
VOICE_SPEED=1.0

# Recording storage
VOICE_RECORDING_BUCKET=engage-voice-recordings
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Twilio webhook secret
TWILIO_WEBHOOK_SECRET=your_webhook_token
```

---

## Feature Flags

Controlar voice campaigns con flags:

```bash
# Activar para un tenant específico
redis-cli SET "ff:voice_campaigns:<tenantId>" "1"
redis-cli SET "ff:voice_ai_generation:<tenantId>" "1"
redis-cli SET "ff:voice_sentiment_analysis:<tenantId>" "1"

# Activar globalmente
redis-cli SET "ff:voice_campaigns" "1"
```

---

## Troubleshooting

### "No active Twilio voice provider configured"
**Causa:** `ChannelProvider` con `channel='voice'` no existe o no está `isActive: true`

**Solución:**
1. Verificar que Twilio esté configurado en dashboard
2. Marcar como "Active" en Settings → Channels
3. Verificar credenciales en `configEncrypted`

### Llamadas encoladas pero no se hacen
**Causa:** Worker de `voice.calls` no está ejecutándose

**Solución:**
```bash
pnpm dev  # Asegurar que worker está corriendo
```

Verificar en Bull Board: `http://localhost:3002`

### "Invalid phone number"
**Causa:** Phone number no está en formato E.164

**Solución:** Usar formato `+5491123456789` (país + código de área + número)

### Webhooks de Twilio no llegan
**Causa:** URL de callback no es accesible desde internet

**Solución:** En desarrollo, usar **ngrok** para tunneling:
```bash
ngrok http 3001
# Use ngrok URL para TWILIO_CALLBACK_URL en .env
```

### "Recording duration is 0"
**Causa:** Recording aún está siendo procesado por Twilio

**Solución:** Esperar 5-10 segundos después de `completedAt` antes de descargar

---

## Ejemplos Completos

### Ejemplo 1: Campaña simple de confirmación

```bash
curl -X POST http://localhost:3001/v1/voice-campaigns \
  -H "x-api-key: pk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Confirmación de evento",
    "script": "Hola {{user.firstName}}, confirma tu asistencia al próximo encuentro. Presiona 1 si vienes, 2 si no.",
    "voiceConfig": {
      "language": "es-ES",
      "voice": "female"
    },
    "dtmfConfig": {
      "enabled": true,
      "options": [
        { "key": "1", "action": "add_to_campaign", "label": "Confirmo" },
        { "key": "2", "action": "add_to_campaign", "label": "No voy" }
      ]
    }
  }'
```

### Ejemplo 2: Campaña con AI y análisis de sentimiento

```bash
curl -X POST http://localhost:3001/v1/voice-campaigns \
  -H "x-api-key: pk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "NPS Survey (AI)",
    "script": "{{user.firstName}}, ¿cuán probable es que nos recomiendes? Presiona de 1 a 9.",
    "aiGenerated": true,
    "aiInstructions": "Tono profesional, cálido, sin presionar. Hacer sentir especial al usuario.",
    "voiceConfig": {
      "language": "es-ES",
      "voice": "male"
    },
    "dtmfConfig": {
      "enabled": true,
      "options": [
        { "key": "1", "action": "feedback", "label": "Muy bajo" },
        { "key": "9", "action": "feedback", "label": "Muy alto" }
      ]
    }
  }'
```

---

## Ver también

- [Voice Campaigns Architecture](/ARCHITECTURE.md#voice-campaigns)
- [API Webhooks](/WEBHOOKS.md)
- [Rules Engine DSL](/RULES_ENGINE.md)
- [Test Plan](/TEST_PLAN.md#voice-campaigns)
