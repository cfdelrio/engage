# WhatsApp Campaigns - Documentación Completa

**WhatsApp Campaigns** es un sistema para enviar mensajes WhatsApp a usuarios vía Twilio WhatsApp API. Soporta:

- Mensajes personalizados con Handlebars templates
- Headers con texto, imagen, documento o video
- Footer text personalizado
- Quick reply buttons
- Seguimiento de estado: enviado, entregado, leído, fallido
- Respeto a quiet hours y frequency caps
- Retry automático con exponential backoff
- Métricas en tiempo real: sent, delivered, read

---

## Inicio Rápido

### 1. Crear una campaña WhatsApp

```bash
curl -X POST http://localhost:3001/v1/whatsapp-campaigns \
  -H "x-api-key: <tu-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Confirmación de Pedido",
    "description": "Notificación a usuarios de nuevo pedido",
    "body": "Hola {{user.firstName}}, tu pedido #{{order.id}} ha sido confirmado",
    "headerType": "text",
    "headerValue": "📦 Pedido Confirmado",
    "footerText": "Saludos - Tu tienda online"
  }'

# Respuesta:
# {
#   "id": "camp_...",
#   "status": "draft",
#   "name": "Confirmación de Pedido",
#   ...
# }
```

### 2. Iniciar campaña

```bash
curl -X POST http://localhost:3001/v1/whatsapp-campaigns/<campaign-id>/start \
  -H "x-api-key: <tu-api-key>"

# Respuesta: { "status": "active", "stats": { "sent": 1245 } }
```

### 3. Monitorear progreso

```bash
curl -X GET http://localhost:3001/v1/whatsapp-campaigns/<campaign-id>/metrics \
  -H "x-api-key: <tu-api-key>"

# Respuesta:
# {
#   "stats": {
#     "sent": 1245,
#     "delivered": 1220,
#     "read": 890,
#     "failed": 25,
#     "deliveryRate": 98,
#     "readRate": 73
#   }
# }
```

---

## API Endpoints

### Campañas

#### `GET /v1/whatsapp-campaigns`
Listar todas las campañas WhatsApp del tenant.

**Query params:**
- `status` (optional): `draft`, `active`, `paused`, `completed`
- `limit` (optional, default 50)
- `offset` (optional, default 0)

**Respuesta:** `WhatsAppCampaign[]`

---

#### `POST /v1/whatsapp-campaigns`
Crear nueva campaña WhatsApp en estado `draft`.

**Body:**
```typescript
{
  name: string;                    // Requerido
  description?: string;
  body: string;                    // Requerido, cuerpo (soporta Handlebars)
  headerType?: string;             // "text" (default), "image", "document", "video"
  headerValue?: string;            // Texto si headerType=text, URL si otro tipo
  footerText?: string;             // Pie de página opcional
  buttons?: Array<{
    id: string;                    // Identificador único del botón
    title: string;                 // Texto visible del botón
  }>;
  aiGenerated?: boolean;           // default false
  aiInstructions?: string;         // Context para AI si aiGenerated=true
  audienceFilter?: ConditionGroup; // DSL JSON conditions
  maxRetries?: number;             // default 2
}
```

**Respuesta:** `{ id, status: "draft", ... }`

---

#### `GET /v1/whatsapp-campaigns/:id`
Obtener detalles de una campaña.

**Respuesta:**
```typescript
{
  id: string;
  name: string;
  description?: string;
  body: string;
  status: "draft" | "active" | "paused" | "completed";
  headerType: string;
  headerValue?: string;
  footerText?: string;
  buttons?: Array<{ id: string; title: string }>;
  stats: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
  createdAt: string;
  updatedAt: string;
}
```

---

#### `PUT /v1/whatsapp-campaigns/:id`
Actualizar campaña (solo si `status` = `draft` o `paused`).

**Body:** Partial update, mismo schema que POST

---

#### `DELETE /v1/whatsapp-campaigns/:id`
Eliminar campaña (solo si `status` = `draft`).

---

#### `POST /v1/whatsapp-campaigns/:id/start`
Iniciar campaña: transición `draft` → `active`.

**Body (optional):**
```typescript
{
  scheduledFor?: string;  // ISO 8601 datetime, null = inmediato
}
```

**Qué sucede:**
1. Busca usuarios con `user.phone` válido
2. Encola jobs en BullMQ queue `whatsapp.messages`
3. Transiciona `status` a `active`

---

#### `POST /v1/whatsapp-campaigns/:id/pause`
Pausar campaña: transición `active` → `paused`.

No afecta mensajes ya enviados.

---

### Mensajes

#### `GET /v1/whatsapp-campaigns/:id/messages`
Listar mensajes de una campaña.

**Query params:**
- `status` (optional): `sent`, `delivered`, `read`, `failed`
- `limit` (optional)
- `offset` (optional)

**Respuesta:**
```typescript
{
  messages: Array<{
    id: string;
    phone: string;
    status: string;
    twilioMessageSid?: string;
    sentAt?: string;
    deliveredAt?: string;
    readAt?: string;
    failedAt?: string;
    errorMessage?: string;
    createdAt: string;
  }>;
  total: number;
}
```

---

#### `GET /v1/whatsapp-campaigns/:id/messages/:messageId`
Obtener detalles de un mensaje específico.

**Respuesta:** Incluye `interactions` (evento log de cambios de estado)

---

### Métricas

#### `GET /v1/whatsapp-campaigns/:id/metrics`
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
    read: number;
    failed: number;
    deliveryRate: number;  // % delivered / sent
    readRate: number;      // % read / delivered
  };
  timeline: Array<{
    date: string;
    messages_sent: number;
    messages_delivered: number;
    messages_read: number;
    messages_failed: number;
  }>;
}
```

---

## Plantillas Handlebars

El cuerpo soporta **Handlebars** para personalización:

```handlebars
Hola {{user.firstName}},

Tu pedido #{{order.id}} ha sido confirmado.
Total: ${{order.amount}}

{{#if order.isPremium}}
  Envío GRATIS por ser cliente Premium 🎁
{{else}}
  Envío: ${{order.shippingCost}}
{{/if}}

Estado: https://example.com/orders/{{order.id}}
```

**Variables disponibles:**
- `{{user.firstName}}` — Nombre del usuario
- `{{user.email}}`
- `{{user.phone}}`
- `{{user.metadata.*}}` — Campos custom en user.metadata

---

## Configuración Twilio

### Setup en Twilio Console

1. Ir a [Twilio Console](https://console.twilio.com)
2. Navegar a "Messaging" → "Try it out" → "Send a WhatsApp message"
3. Crear WhatsApp Sender (business phone number o sandbox)
4. Obtener credenciales:
   - Account SID
   - Auth Token
   - WhatsApp Phone Number (+1234567890)

### Env Variables

```env
# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_PHONE_NUMBER=+1234567890

# Webhooks (optional, para status updates)
TWILIO_WEBHOOK_SECRET=your_webhook_token
```

### Teléfonos de Usuario

Los números de teléfono se guardan en `User.phone` (formato E.164):

```typescript
{
  phone: "+5491123456789"  // E.164: +[country][area][number]
}
```

Los clientes deben registrar sus números vía API:

```bash
# PUT /v1/users/:id
curl -X PUT http://localhost:3001/v1/users/user123 \
  -H "x-api-key: <key>" \
  -d '{ "phone": "+5491123456789" }'
```

---

## Quiet Hours

Los mensajes respetan quiet hours del usuario:

```json
{
  "quietHoursStart": 22,  // 10 PM
  "quietHoursEnd": 9      // 9 AM
}
```

Si se intenta enviar fuera de quiet hours, se reschedule para la hora permitida.

---

## Frequency Caps

Limitar mensajes por usuario/período:

```bash
# Máximo 3 mensajes por día
curl -X PUT http://localhost:3001/v1/users/:id/preferences \
  -H "x-api-key: <key>" \
  -d '[
    {
      "channel": "whatsapp",
      "enabled": true,
      "quietHoursStart": 22,
      "quietHoursEnd": 9,
      "frequencyCap": {
        "maxCount": 3,
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
  "name": "Confirmación de pedido",
  "conditions": {
    "operator": "AND",
    "conditions": [
      { "field": "event.type", "operator": "eq", "value": "order.created" },
      { "field": "user.phone", "operator": "exists", "value": true }
    ]
  },
  "actions": [{
    "type": "START_WHATSAPP_CAMPAIGN",
    "params": { "campaignId": "camp_order_confirm" }
  }]
}
```

---

## Retry Logic

Si un mensaje falla:

1. **Intento 1**: Si falla, espera 1 minuto y reintenta
2. **Intento 2**: Si falla, espera 5 minutos y reintenta
3. **Intento 3**: Si falla, espera 30 minutos y reintenta
4. **Después**: Marca como `failed`, registra en `WhatsAppMessage.errorMessage`

Causas comunes de fallo:
- Número inválido o incorrecto (no será reintentado)
- Twilio account no verificado (reintentable)
- Número not opted in a WhatsApp Business (reintentable)
- Rate limits (reintentable)

---

## Webhooks

Twilio envía actualizaciones de estado a:

```
POST /webhooks/twilio/whatsapp/status
```

**Payload:**
```json
{
  "MessageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "MessageStatus": "sent|delivered|read|failed|undelivered"
}
```

**Estados mapeados:**
- `sent` → Message enviado a servidor de Twilio
- `delivered` → Mensaje entregado al teléfono del usuario
- `read` → Usuario leyó el mensaje
- `failed` / `undelivered` → No se pudo entregar (error en Twilio)

---

## Headers

WhatsApp soporta diferentes tipos de headers:

### Text Header
```bash
curl -X POST http://localhost:3001/v1/whatsapp-campaigns \
  -d '{
    "headerType": "text",
    "headerValue": "📦 Seguimiento de Envío",
    "body": "Tu pedido está en camino..."
  }'
```

Resultado en WhatsApp:
```
📦 Seguimiento de Envío

Tu pedido está en camino...
```

### Image Header
```bash
curl -X POST http://localhost:3001/v1/whatsapp-campaigns \
  -d '{
    "headerType": "image",
    "headerValue": "https://cdn.example.com/promo.jpg",
    "body": "¡Oferta especial!"
  }'
```

### Document Header
```bash
curl -X POST http://localhost:3001/v1/whatsapp-campaigns \
  -d '{
    "headerType": "document",
    "headerValue": "https://cdn.example.com/invoice.pdf",
    "body": "Tu factura está adjunta"
  }'
```

### Video Header
```bash
curl -X POST http://localhost:3001/v1/whatsapp-campaigns \
  -d '{
    "headerType": "video",
    "headerValue": "https://cdn.example.com/tutorial.mp4",
    "body": "Mira este tutorial"
  }'
```

---

## Buttons

Quick reply buttons (máximo 3):

```bash
curl -X POST http://localhost:3001/v1/whatsapp-campaigns \
  -d '{
    "body": "¿Cómo fue tu experiencia?",
    "buttons": [
      { "id": "excellent", "title": "Excelente ⭐⭐⭐" },
      { "id": "good", "title": "Bueno ⭐⭐" },
      { "id": "bad", "title": "Malo ⭐" }
    ]
  }'
```

El usuario tapa un botón, el texto "Excelente ⭐⭐⭐" se envía como respuesta.

---

## Rate Limits

Twilio WhatsApp tiene límites:

- **Tier 0** (sandbox): 100 mensajes/día
- **Tier 1** (business verified): 1,000 mensajes/día
- **Tier 2+**: Sin límite (depende del contrato)

El sistema respeta estos límites automáticamente (queue con backoff).

---

## Troubleshooting

### "Invalid phone number format"
- Asegúrate que el teléfono esté en formato E.164: +[país][número]
- Ejemplo válido: +5491123456789
- Inválido: 11 2345 6789, 0112345678

### "WhatsApp not activated for this number"
- El usuario no tiene WhatsApp en ese número
- El usuario no ha optado in (never received message from number before)
- Solución: El usuario debe iniciar conversación con tu business number primero

### "Twilio authentication failed"
- Verifica `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_PHONE_NUMBER`
- Prueba en [Twilio Console](https://console.twilio.com)

### "Message not delivered after retries"
- Verifica el teléfono en `WhatsAppMessage.errorMessage`
- Revisa Twilio logs en [Console → Logs](https://console.twilio.com/logs/events)
- Contacta al usuario para confirmar el número

---

## Ejemplos de Casos de Uso

### 1. Confirmación de Pedido

```json
{
  "name": "Order Confirmation",
  "body": "Hola {{user.firstName}}, tu pedido #{{order.id}} ha sido confirmado. Total: ${{order.amount}}. Seguimiento: https://example.com/orders/{{order.id}}",
  "headerType": "text",
  "headerValue": "✅ Pedido Confirmado",
  "footerText": "Tu tienda online"
}
```

### 2. Recordatorio de Pago Pendiente

```json
{
  "name": "Payment Reminder",
  "body": "Hola {{user.firstName}}, te recordamos que tu pago por ${{invoice.amount}} vence {{invoice.dueDate}}. Paga aquí: https://example.com/pay/{{invoice.id}}",
  "headerType": "text",
  "headerValue": "💳 Pago Pendiente",
  "buttons": [
    { "id": "pay", "title": "Pagar Ahora" },
    { "id": "later", "title": "Pagar Después" }
  ]
}
```

### 3. Reactivación de Usuario Inactivo

```json
{
  "name": "Reactivation Campaign",
  "body": "¡Hola {{user.firstName}}! Te extrañamos. Vuelve y disfruta de ofertas exclusivas solo para ti. Entra: https://example.com/special-offer",
  "headerType": "image",
  "headerValue": "https://cdn.example.com/welcome-back.jpg",
  "footerText": "¡Esperamos verte pronto!"
}
```

### 4. Seguimiento de Envío

```json
{
  "name": "Shipment Tracking",
  "body": "Tu pedido {{order.id}} está en camino 📦. Será entregado {{shipment.estimatedDelivery}}. Rastrear: https://example.com/track/{{shipment.id}}",
  "buttons": [
    { "id": "track", "title": "Rastrear" },
    { "id": "support", "title": "Soporte" }
  ]
}
```

---

## Performance & Best Practices

### Handlebars Compilation
- Los templates se compilan una sola vez al iniciar la campaña
- Los mismos templates se reutilizan para cada usuario
- Usa Handlebars simples (no helpers complejos)

### Batch Processing
- Las campañas usan BullMQ para procesar mensajes en paralelo
- Default: 4 workers simultaneos (configurable)
- Respeta rate limits de Twilio automáticamente

### Metrics Aggregation
- Las métricas se calculan on-demand al llamar `/metrics`
- Se cachean en Redis por 5 minutos
- Para reportes históricos, usa `/timeline`

### Phone Number Validation
- El sistema valida E.164 format automáticamente
- Números inválidos se marcan como `failed` sin intentos de reenvío

---
