# Push Notifications - Documentación Completa

**Push Campaigns** es un sistema para enviar notificaciones push a dispositivos de usuarios vía Firebase Cloud Messaging (FCM). Soporta:

- Notificaciones personalizadas con Handlebars templates
- Imágenes, URLs de acción, badges y sonidos
- Prioridades (high, default, low)
- Respeto a quiet hours y frequency caps
- Retry automático con exponential backoff
- Métricas en tiempo real: sent, delivered, opened, clicked

---

## Inicio Rápido

### 1. Crear una campaña push

```bash
curl -X POST http://localhost:3001/v1/push-campaigns \
  -H "x-api-key: <tu-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Oferta Especial",
    "description": "Push a usuarios en Argentina",
    "title": "¡Oferta exclusiva!",
    "body": "Hola {{user.firstName}}, tienes 30% de descuento en tu próxima compra",
    "imageUrl": "https://cdn.example.com/promo.jpg",
    "actionUrl": "https://example.com/promo",
    "priority": "high",
    "sound": "default",
    "badge": 1
  }'

# Respuesta:
# {
#   "id": "camp_...",
#   "status": "draft",
#   "name": "Oferta Especial",
#   ...
# }
```

### 2. Iniciar campaña

```bash
curl -X POST http://localhost:3001/v1/push-campaigns/<campaign-id>/start \
  -H "x-api-key: <tu-api-key>"

# Respuesta: { "status": "active", "stats": { "sent": 1245 } }
```

### 3. Monitorear progreso

```bash
curl -X GET http://localhost:3001/v1/push-campaigns/<campaign-id>/metrics \
  -H "x-api-key: <tu-api-key>"

# Respuesta:
# {
#   "stats": {
#     "sent": 1245,
#     "delivered": 1220,
#     "opened": 890,
#     "clicked": 450,
#     "failed": 25,
#     "deliveryRate": 98,
#     "openRate": 73,
#     "clickRate": 50
#   }
# }
```

---

## API Endpoints

### Campañas

#### `GET /v1/push-campaigns`
Listar todas las campañas push del tenant.

**Query params:**
- `status` (optional): `draft`, `active`, `paused`, `completed`
- `limit` (optional, default 50)
- `offset` (optional, default 0)

**Respuesta:** `PushCampaign[]`

---

#### `POST /v1/push-campaigns`
Crear nueva campaña push en estado `draft`.

**Body:**
```typescript
{
  name: string;                    // Requerido
  description?: string;
  title: string;                   // Requerido, título de notificación
  body: string;                    // Requerido, cuerpo (soporta Handlebars)
  imageUrl?: string;               // URL de imagen/ícono
  actionUrl?: string;              // Deep link o URL al hacer tap
  badge?: number;                  // Badge count en ícono
  sound?: string;                  // "default" o custom sound
  priority?: string;               // "high" (default), "default", "low"
  ttl?: number;                    // Time to live en segundos
  aiGenerated?: boolean;           // default false
  aiInstructions?: string;         // Context para AI si aiGenerated=true
  audienceFilter?: ConditionGroup; // DSL JSON conditions
  maxRetries?: number;             // default 2
}
```

**Respuesta:** `{ id, status: "draft", ... }`

---

#### `GET /v1/push-campaigns/:id`
Obtener detalles de una campaña.

**Respuesta:**
```typescript
{
  id: string;
  name: string;
  description?: string;
  title: string;
  body: string;
  status: "draft" | "active" | "paused" | "completed";
  imageUrl?: string;
  actionUrl?: string;
  priority: string;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
  };
  createdAt: string;
  updatedAt: string;
}
```

---

#### `PUT /v1/push-campaigns/:id`
Actualizar campaña (solo si `status` = `draft` o `paused`).

**Body:** Partial update, mismo schema que POST

---

#### `DELETE /v1/push-campaigns/:id`
Eliminar campaña (solo si `status` = `draft`).

---

#### `POST /v1/push-campaigns/:id/start`
Iniciar campaña: transición `draft` → `active`.

**Body (optional):**
```typescript
{
  scheduledFor?: string;  // ISO 8601 datetime, null = inmediato
}
```

**Qué sucede:**
1. Busca usuarios matching `audienceFilter`
2. Para cada usuario: obtiene `deviceTokens`
3. Encola jobs en BullMQ queue `push.notifications`
4. Transiciona `status` a `active`

---

#### `POST /v1/push-campaigns/:id/pause`
Pausar campaña: transición `active` → `paused`.

No afecta notificaciones ya enviadas.

---

### Notificaciones

#### `GET /v1/push-campaigns/:id/notifications`
Listar notificaciones de una campaña.

**Query params:**
- `status` (optional): `queued`, `sent`, `delivered`, `opened`, `clicked`, `failed`
- `limit` (optional)
- `offset` (optional)

**Respuesta:**
```typescript
{
  notifications: Array<{
    id: string;
    deviceToken: string;
    status: string;
    firebaseMessageId?: string;
    sentAt?: string;
    deliveredAt?: string;
    openedAt?: string;
    clickedAt?: string;
    failedAt?: string;
    errorMessage?: string;
    createdAt: string;
  }>;
  total: number;
}
```

---

#### `GET /v1/push-notifications/:id`
Obtener detalles de una notificación específica.

**Respuesta:** Incluye `interactions` (evento log de cambios de estado)

---

### Métricas

#### `GET /v1/push-campaigns/:id/metrics`
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
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
    deliveryRate: number;  // % delivered / sent
    openRate: number;      // % opened / delivered
    clickRate: number;     // % clicked / opened
  };
  timeline: Array<{
    date: string;
    notifications_sent: number;
    notifications_delivered: number;
    notifications_opened: number;
    notifications_clicked: number;
    notifications_failed: number;
  }>;
}
```

---

## Plantillas Handlebars

El cuerpo soporta **Handlebars** para personalización:

```handlebars
Hola {{user.firstName}},

{{#if user.metadata.isPremium}}
  Tienes acceso exclusivo a esta oferta
{{else}}
  Actualiza a Premium para más beneficios
{{/if}}

Tap aquí: https://example.com/promo
```

**Variables disponibles:**
- `{{user.firstName}}` — Nombre del usuario
- `{{user.email}}`
- `{{user.phone}}`
- `{{user.metadata.*}}` — Campos custom en user.metadata

---

## Configuración Firebase

### Setup en GCP

1. Crear proyecto en [Google Cloud Console](https://console.cloud.google.com)
2. Habilitar Firebase Cloud Messaging API
3. Crear service account con rol "Firebase Cloud Messaging API Admin"
4. Descargar JSON de credenciales
5. Guardar en `FIREBASE_SERVICE_ACCOUNT_JSON` env var (o en Secrets Manager en prod)

### Env Variables

```env
# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT_JSON='{
  "type": "service_account",
  "project_id": "my-project",
  "private_key_id": "...",
  "private_key": "...",
  "client_email": "...",
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "..."
}'
```

### Device Tokens

Los device tokens se guardan en `User.deviceTokens` (JSON array):

```typescript
{
  deviceTokens: [
    "eKzl...",  // FCM token desde web app
    "dYa2...",  // FCM token desde iOS app
    "xY7k..."   // FCM token desde Android app
  ]
}
```

Los cliente deben llamar a un endpoint para registrar sus tokens:

```bash
# POST /v1/users/:id/device-tokens
curl -X POST http://localhost:3001/v1/users/user123/device-tokens \
  -H "x-api-key: <key>" \
  -d '{ "token": "eKzl..." }'
```

---

## Quiet Hours

Las notificaciones respetan quiet hours del usuario:

```json
{
  "quietHoursStart": 22,  // 10 PM
  "quietHoursEnd": 9      // 9 AM
}
```

Si se intenta enviar fuera de quiet hours, se reschedule para la hora permitida.

---

## Frequency Caps

Limitar notificaciones por usuario/período:

```bash
# Máximo 5 notificaciones por día
curl -X PUT http://localhost:3001/v1/users/:id/preferences \
  -H "x-api-key: <key>" \
  -d '[
    {
      "channel": "push",
      "enabled": true,
      "quietHoursStart": 22,
      "quietHoursEnd": 9,
      "frequencyCap": {
        "maxCount": 5,
        "windowSeconds": 86400  // 1 día
      }
    }
  ]'
```

---

## Integración con Rules Engine

Desencadenar campañas automáticamente:

```json
{
  "name": "Enviar promoción a usuarios activos",
  "conditions": {
    "operator": "AND",
    "conditions": [
      { "field": "event.type", "operator": "eq", "value": "user.login" },
      { "field": "user.engagementScore", "operator": "gte", "value": 70 }
    ]
  },
  "actions": [{
    "type": "START_PUSH_CAMPAIGN",
    "params": { "campaignId": "camp_promo" }
  }]
}
```

---

## Retry Logic

Si una notificación falla:

| Intento | Delay |
|---------|-------|
| 1er intento | Inmediato |
| Fallo → 2do | 1 minuto |
| Fallo → 3er | 5 minutos |
| Fallo → 4to | 30 minutos |
| Máx retries | Marca como `failed` |

Cambiar `maxRetries` en campaña:

```bash
curl -X PUT http://localhost:3001/v1/push-campaigns/<id> \
  -H "x-api-key: <key>" \
  -d '{ "maxRetries": 5 }'
```

---

## AI Content Generation

Si `aiGenerated: true`, Claude enriquece el body:

```bash
curl -X POST http://localhost:3001/v1/push-campaigns \
  -H "x-api-key: <key>" \
  -d '{
    "name": "AI Promo",
    "title": "Oferta",
    "body": "Usuario {{user.firstName}} tiene descuento",
    "aiGenerated": true,
    "aiInstructions": "Tono amigable y urgente, máx 80 caracteres"
  }'
```

Feature flag: `PUSH_AI_GENERATION`

---

## Estadísticas

### Métricas Diarias

Las métricas se agregan automáticamente en `PushMetric` (tabla):

```
date: 2026-05-20
notifications_sent: 1000
notifications_delivered: 980
notifications_opened: 700
notifications_clicked: 350
notifications_failed: 20
```

### Interacciones

Cada cambio de estado genera `PushInteraction`:

```
type: "delivered"       # Cuando Firebase confirma entrega
type: "opened"          # Cuando usuario abre notificación
type: "clicked"         # Cuando usuario hace tap
type: "sent"            # Cuando se envía a Firebase
```

---

## Troubleshooting

### "No active Firebase provider configured"
**Causa:** ChannelProvider para push no existe o no está active

**Solución:**
1. Settings → Channels → Firebase
2. Pegar credenciales JSON
3. Marcar como "Active"

### "Invalid device token"
**Causa:** Token expirado o malformado

**Solución:** Renovar token en app cliente y reregistrar

### Notificaciones no se entregan
**Causa:** Quiet hours, frequency cap, o unsubscribe

**Solución:** Verificar en dashboard → User → Preferences

### Retry no funcionan
**Causa:** Worker no está ejecutándose

**Solución:**
```bash
pnpm dev  # Verificar que worker está corriendo
```

Monitor en http://localhost:3002 (Bull Board)

---

## Examples Completos

### Ejemplo 1: Oferta Time-Limited

```bash
curl -X POST http://localhost:3001/v1/push-campaigns \
  -H "x-api-key: pk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Flash Sale 24h",
    "title": "¡Sale empieza ahora!",
    "body": "Hola {{user.firstName}}, corre a {{user.metadata.favoriteCategory || \"comprar\"}}",
    "imageUrl": "https://cdn.example.com/sale.jpg",
    "actionUrl": "https://example.com/sale",
    "priority": "high",
    "badge": 1,
    "sound": "default"
  }'
```

### Ejemplo 2: Engagement Re-activation

```bash
# Crear campaña
CAMPAIGN_ID=$(curl -X POST http://localhost:3001/v1/push-campaigns \
  -H "x-api-key: pk_test_..." \
  -d '{ "name": "Come back", "title": "Te echamos de menos", "body": "...", "priority": "default" }' \
  | jq -r .id)

# Crear regla que gatille automáticamente
curl -X POST http://localhost:3001/v1/rules \
  -H "x-api-key: pk_test_..." \
  -d '{
    "name": "7d inactive → push",
    "conditions": {
      "field": "event.type",
      "operator": "eq",
      "value": "user.inactive_7d"
    },
    "actions": [{
      "type": "START_PUSH_CAMPAIGN",
      "params": { "campaignId": "'$CAMPAIGN_ID'" }
    }]
  }'
```

### Ejemplo 3: Segment-Specific Content

```bash
curl -X POST http://localhost:3001/v1/push-campaigns \
  -H "x-api-key: pk_test_..." \
  -d '{
    "name": "VIP Exclusive",
    "title": "VIP Access",
    "body": "Hola {{user.firstName}}, acceso early access a nueva colección",
    "actionUrl": "https://example.com/vip",
    "audienceFilter": {
      "operator": "AND",
      "conditions": [
        { "field": "user.metadata.isPremium", "operator": "eq", "value": true },
        { "field": "user.engagementScore", "operator": "gte", "value": 80 }
      ]
    }
  }'
```

---

## Ver también

- [README.md](/README.md) — Intro rápido
- [API_REFERENCE.md](/API_REFERENCE.md) — Referencia de endpoints
- [ARCHITECTURE.md](/ARCHITECTURE.md) — Diseño del sistema
- [Firebase Console](https://console.firebase.google.com)
- [FCM Documentation](https://firebase.google.com/docs/cloud-messaging)
