# ProdeCaballito × ORKESTAI ENGAGE — Guía de Integración

## Introducción

Este documento detalla cómo ProdeCaballito debe adaptarse para enviar sus notificaciones a través de ORKESTAI ENGAGE en lugar de hacerlo directamente a Resend, Infobip, Twilio, etc.

**Ventaja:** Un único endpoint (`POST /v1/events`), Engage maneja el routing a múltiples canales, templates, validaciones de consent, reintentos y métricas.

---

## 1. Setup Inicial

### 1.1 Obtener API Key

Contactar al admin de Engage para crear una API key para el tenant `prodecaballito`:

```bash
# Admin de Engage ejecuta:
curl -X POST http://localhost:3001/v1/admin/api-keys \
  -H "authorization: Bearer <admin_jwt>" \
  -H "content-type: application/json" \
  -d '{
    "name": "ProdeCaballito Integration",
    "permissions": ["events:write", "users:read", "deliveries:read"]
  }'

# Respuesta:
{
  "id": "key_xxxx",
  "keyHash": "sha256...",
  "keyPrefix": "pk_prode1",
  "key": "pk_prode1_xxxxxxxxx"  ← GUARDAR ESTO
}
```

### 1.2 Environment Variables en ProdeCaballito

Agregar a `.env.local`:

```env
# Engage Integration
ENGAGE_API_URL=https://engage.api.com  # o http://localhost:3001 en dev
ENGAGE_API_KEY=pk_prode1_xxxxxxxxx    # del paso anterior
ENGAGE_ENABLED=true
```

### 1.3 HTTP Client (TypeScript/Node.js)

```typescript
// src/lib/engage-client.ts
import axios from "axios";

const engageClient = axios.create({
  baseURL: process.env.ENGAGE_API_URL,
  headers: {
    "x-api-key": process.env.ENGAGE_API_KEY,
    "content-type": "application/json",
  },
});

export async function sendEvent(payload: EngageEventPayload) {
  if (!process.env.ENGAGE_ENABLED) return null; // fallback a notificaciones locales

  try {
    const response = await engageClient.post("/v1/events", payload);
    return response.data; // { eventId, status: 'queued' }
  } catch (error) {
    console.error("[Engage] Event submission failed:", error);
    // Fallback a notificaciones locales o retry con backoff
    throw error;
  }
}
```

---

## 2. Mapear Event Types

Engage gestiona **26 tipos de eventos** que se corresponden con situaciones en ProdeCaballito:

| Situación en ProdeCaballito      | Event Type                          | Canales              |
| -------------------------------- | ----------------------------------- | -------------------- |
| Envío de código OTP              | `prode.verification_code`           | SMS, Email           |
| Bienvenida al usuario            | `prode.welcome`                     | Email, WhatsApp      |
| Recordatorio de apuestas         | `prode.bet_reminder`                | SMS, WhatsApp        |
| Recordatorio de cierre           | `prode.cutoff_reminder`             | SMS, WhatsApp        |
| Partido reprogramado             | `prode.match_rescheduled`           | Email, SMS, WhatsApp |
| Pago pendiente                   | `prode.payment_pending`             | Email, SMS, WhatsApp |
| Pitazo inicial                   | `prode.kickoff`                     | SMS                  |
| Segundo tiempo                   | `prode.second_half`                 | SMS                  |
| Resultado publicado (broadcast)  | `prode.result_published.broadcast`  | Email                |
| Resultado publicado (individual) | `prode.result_published.individual` | Email, WhatsApp      |
| Nuevo líder                      | `prode.new_leader`                  | WhatsApp             |
| Cambio en ranking (subida)       | `prode.ranking_change.up`           | SMS                  |
| Cambio en ranking (entrada)      | `prode.ranking_change.entered`      | SMS                  |
| Cambio en ranking (bajada)       | `prode.ranking_change.down`         | _(suprimido)_        |
| Cerca del podio                  | `prode.near_podio`                  | SMS, WhatsApp        |
| Torneo mañana                    | `prode.tournament_tomorrow`         | Email, SMS           |
| Resumen de fecha                 | `prode.matchday_summary`            | Email                |
| Récord personal                  | `prode.personal_record`             | SMS                  |
| Racha de exactos                 | `prode.streak_exactos`              | SMS                  |
| Ganador (personal)               | `prode.winner.personal`             | Email, WhatsApp      |
| Ganador (broadcast)              | `prode.winner.broadcast`            | Email                |
| Resumen semanal                  | `prode.weekly_digest`               | Email                |
| Planilla de cierre               | `prode.planilla_cierre`             | Email, SMS           |
| Broadcast manual                 | `prode.broadcast_manual`            | Email, SMS, WhatsApp |
| Encuesta de voz                  | `prode.voice_survey`                | Voice                |

---

## 3. Contrato de API

### 3.1 Schema del Evento

```typescript
interface EngageEvent {
  type: string; // uno de los 26 tipos arriba
  userId: string; // ID externo del usuario en ProdeCaballito
  idempotencyKey?: string; // para deduplicación; si no, Engage genera uno
  payload: Record<string, unknown>; // negocio específico del evento
  metadata?: {
    user_contact?: {
      // contacto actualizado del usuario
      nombre?: string;
      email?: string;
      phone?: string; // E.164: +5491100000000
      whatsapp_consent?: boolean; // boolean: usuario optó en/out para WA
      idioma_pref?: string; // 'es-AR', 'es', 'en', etc.
    };
    channels_hint?: string[]; // opcional: sugerencia de canales
  };
  timestamp?: string; // ISO 8601; si no, ahora
}
```

### 3.2 Response

```typescript
interface EngageEventResponse {
  eventId: string; // ID único del evento en Engage
  status: "queued"; // siempre 202 Accepted
}
```

### 3.3 Error Handling

```typescript
// 202 Accepted — evento encolado exitosamente
{ eventId: 'evt_xxx', status: 'queued' }

// 409 Conflict — evento duplicado (mismo idempotencyKey)
{ error: 'Duplicate event', idempotencyKey: 'xxx' }

// 400 Bad Request — schema inválido
{ error: 'Invalid event schema: ...', code: 'INVALID_SCHEMA' }

// 401 Unauthorized — API key inválida
{ error: 'Invalid API key' }
```

---

## 4. Casos de Uso Paso a Paso

### Caso 1: OTP via SMS

```typescript
// En ProdeCaballito, cuando genera OTP:
import { sendEvent } from "../lib/engage-client";

async function sendOTP(user: User, code: string) {
  await sendEvent({
    type: "prode.verification_code",
    userId: user.id.toString(),
    idempotencyKey: `otp:${user.id}:${Date.now()}`,
    payload: {
      code,
      expiresIn: 600, // segundos
    },
    metadata: {
      user_contact: {
        phone: user.phone,
        email: user.email,
        idioma_pref: "es-AR",
      },
    },
  });
  // Engage automáticamente envía SMS (via Twilio)
}
```

### Caso 2: Resultado de Partido

```typescript
// En ProdeCaballito, cuando publica resultado:
async function publishMatchResult(match: Match, user: User, userBet: UserBet) {
  const ranking = await db.getUserRanking(user.id);

  await sendEvent({
    type: "prode.result_published.individual",
    userId: user.id.toString(),
    idempotencyKey: `result:${match.id}:${user.id}`,
    payload: {
      business_context: {
        match: {
          id: match.id,
          local: match.homeTeam.name,
          away: match.awayTeam.name,
          goles_local: match.scoreHome,
          goles_visitante: match.scoreAway,
        },
        bet: {
          goles_local: userBet.predictHome,
          goles_visitante: userBet.predictAway,
          puntos_obtenidos: userBet.pointsEarned,
        },
        ranking_after: {
          position: ranking.position,
          delta: ranking.deltaFromPrevious,
          planilla_nombre: ranking.planillaName,
        },
        outcome: userBet.outcome, // 'exacto' | 'resultado' | 'doble_chance' | null
      },
    },
    metadata: {
      user_contact: {
        nombre: user.firstName,
        email: user.email,
        phone: user.phone,
        whatsapp_consent: user.whatsappConsent ?? true,
        idioma_pref: user.preferredLanguage,
      },
    },
  });
  // Engage automáticamente envía Email + WhatsApp (si consent=true)
}
```

### Caso 3: Cambio de Ranking

```typescript
// En ProdeCaballito, cuando la posición del usuario cambia:
async function onRankingChange(user: User, oldRank: number, newRank: number) {
  if (newRank < oldRank) {
    // Subió en ranking
    await sendEvent({
      type: "prode.ranking_change.up",
      userId: user.id.toString(),
      idempotencyKey: `ranking_up:${user.id}:${Date.now()}`,
      payload: {
        oldRank,
        newRank,
        delta: oldRank - newRank,
      },
      metadata: {
        user_contact: {
          phone: user.phone,
          idioma_pref: user.preferredLanguage,
        },
      },
    });
    // Engage envía SMS (via Twilio)
  } else if (newRank <= 3) {
    // Entró en top 3
    await sendEvent({
      type: "prode.ranking_change.entered",
      userId: user.id.toString(),
      idempotencyKey: `ranking_top3:${user.id}:${Date.now()}`,
      payload: { rank: newRank },
      metadata: {
        user_contact: { phone: user.phone },
      },
    });
  }
}
```

### Caso 4: Broadcast Manual (ej: anuncio)

```typescript
// En ProdeCaballito, cuando un admin envía un broadcast:
async function sendBroadcastManual(
  users: User[],
  content: string,
  channel: "email" | "sms" | "whatsapp",
) {
  for (const user of users) {
    await sendEvent({
      type: "prode.broadcast_manual",
      userId: user.id.toString(),
      idempotencyKey: `broadcast:${Date.now()}:${user.id}`,
      payload: {
        content,
        channel,
      },
      metadata: {
        user_contact: {
          email: user.email,
          phone: user.phone,
          nombre: user.firstName,
        },
      },
    });
  }
  // Engage enruta según channel
}
```

### Caso 5: Encuesta de Voz (Future)

```typescript
// En ProdeCaballito, para recopilar feedback vía IVR:
async function sendVoiceSurvey(user: User, surveyScript: string) {
  await sendEvent({
    type: "prode.voice_survey",
    userId: user.id.toString(),
    idempotencyKey: `survey:${user.id}:${Date.now()}`,
    payload: {
      script: surveyScript,
      language: "es-AR",
      recordingEnabled: true,
    },
    metadata: {
      user_contact: {
        phone: user.phone,
        nombre: user.firstName,
      },
    },
  });
  // Engage inicia llamada Twilio Voice con TwiML
}
```

---

## 5. Datos Críticos

### 5.1 `user_contact` — Cómo llenar cada campo

| Campo              | Obligatorio | Ejemplo              | Notas                                              |
| ------------------ | ----------- | -------------------- | -------------------------------------------------- |
| `email`            | No          | `carlos@example.com` | Requerido solo si canal=email. Engage lo valida.   |
| `phone`            | No          | `+5491123456789`     | **E.164 format**. Requerido para SMS/WA/Voice.     |
| `whatsapp_consent` | No          | `true`               | **CRÍTICO**: Engage solo envía WhatsApp si `true`. |
| `nombre`           | No          | `Carlos`             | Para personalización de templates.                 |
| `idioma_pref`      | No          | `es-AR`              | Para seleccionar template localizado.              |

**Regla de oro**: Si NO envías `user_contact` con datos completos, Engage no puede entregar el mensaje.

### 5.2 `payload.business_context` — Qué incluir

El payload depende del event type, pero **siempre incluye contexto de negocio**:

```typescript
// Para result_published.individual:
payload: {
  business_context: {
    match: { id, local, away, goles_local, goles_visitante },
    bet: { goles_local, goles_visitante, puntos_obtenidos },
    ranking_after: { position, delta, planilla_nombre },
    outcome: 'exacto' | 'resultado' | 'doble_chance' | null,
  }
}

// Para ranking_change.up:
payload: {
  oldRank, newRank, delta
}

// Para broadcast_manual:
payload: {
  content: string,
  channel: 'email' | 'sms' | 'whatsapp'
}
```

Engage usa `payload.business_context` para **renderizar templates con Handlebars**:

```
Tema Email: "¡{{payload.business_context.match.local}} vs {{payload.business_context.match.away}}!"
Body: "Obtuviste {{payload.business_context.bet.puntos_obtenidos}} puntos. Eres #{{ranking.position}}"
```

---

## 6. Estrategia de Adopción Gradual

### Fase 1: Pilot (1-2 semanas)

Comenzar con **1 event type** (ej: `prode.verification_code`):

```typescript
// En src/services/auth.ts:
async function sendOtpCode(user: User, code: string) {
  if (process.env.ENGAGE_ENABLED === 'true') {
    // Nuevo: enviar a Engage
    await sendEvent({
      type: 'prode.verification_code',
      userId: user.id.toString(),
      // ...
    });
  } else {
    // Fallback: enviar directo a Twilio (código actual)
    await twilioClient.messages.create({ ... });
  }
}
```

**Ventaja**: Fácil rollback si hay problemas. Feature flag en `.env`.

### Fase 2: Validación (1-2 semanas)

- ✅ Monitorear métricas de entrega en Engage dashboard
- ✅ Comparar tasas de apertura/click con método anterior
- ✅ Validar que usuarios reciben mensajes en hora correcta (quiet hours)

Si OK, agregar **5 event types** más (OTP, welcome, bet_reminder, etc.)

### Fase 3: Migración Completa (2-4 semanas)

Una vez estables:

- ✅ Retirar integraciones directas a Resend, Infobip, Twilio SMS
- ✅ Eliminar env vars: `RESEND_API_KEY`, `INFOBIP_API_KEY`, `TWILIO_ACCOUNT_SID` (para SMS)
- ✅ Mantener SOLO `TWILIO_ACCOUNT_SID` para Voice futuro si aplica

**Web Push VAPID**: ProdeCaballito **mantiene** (no está en Engage MVP). Seguir usando Firebase directamente.

---

## 7. Fallback / Modo Degradado

**¿Qué pasa si Engage está caído?**

```typescript
async function sendEvent(payload: EngageEventPayload) {
  try {
    const response = await engageClient.post("/v1/events", payload);
    console.log(`[Engage] Event ${response.data.eventId} queued`);
  } catch (error) {
    console.error("[Engage] Failed, falling back to local delivery:", error);

    // Fallback: enviar localmente (old behavior)
    if (payload.type.includes("verification_code")) {
      await twilioClient.messages.create({
        to: payload.metadata.user_contact.phone,
        body: `Tu código es: ${payload.payload.code}`,
      });
    }
    // ... más fallbacks por type
  }
}
```

**Recomendación**: Mantener código de fallback por **al menos 3 meses** durante la migración.

---

## 8. Monitoreo y Debugging

### 8.1 Ver eventos en Engage dashboard

```
http://localhost:3000/dashboard
→ Tab "Events"
→ Filtrar por type, userId, status
```

### 8.2 Verificar entrega de un usuario específico

```bash
curl -X GET http://localhost:3001/v1/users/{userId}/deliveries \
  -H "x-api-key: pk_prode1_..."
```

Respuesta:

```json
[
  {
    "id": "dlv_xxx",
    "channel": "email",
    "status": "delivered",
    "sentAt": "2025-05-21T10:30:00Z",
    "deliveredAt": "2025-05-21T10:30:15Z",
    "openedAt": "2025-05-21T10:35:00Z"
  }
]
```

### 8.3 Logs en Engage worker

```bash
# Tail del worker (donde se procesan reglas y se crea Deliveries):
docker logs engage-worker -f | grep prode
```

### 8.4 Bull Board (UI para queues)

```
http://localhost:3002
→ Queue: "events.incoming"
→ Ver jobs, errores, retries
```

---

## 9. Eliminación de Integraciones Directas

### Antes: Fan-out en ProdeCaballito

```typescript
// src/services/notifications.ts (ANTES)
async function notifyUserOfResult(user: User, result: MatchResult) {
  // Email
  await resend.emails.send({
    from: "noreply@prode.com",
    to: user.email,
    subject: "Tu resultado",
    html: emailTemplate(result),
  });

  // SMS
  await infobip.sms.send({
    phone: user.phone,
    text: smsTemplate(result),
  });

  // WhatsApp
  if (user.whatsappConsent) {
    await twilio.messages.create({
      from: "whatsapp:+1234567890",
      to: `whatsapp:${user.phone}`,
      body: waTemplate(result),
    });
  }
}
```

### Después: Un único evento a Engage

```typescript
// src/services/notifications.ts (DESPUÉS)
async function notifyUserOfResult(user: User, result: MatchResult) {
  await sendEvent({
    type: "prode.result_published.individual",
    userId: user.id.toString(),
    payload: { business_context: { match: result } },
    metadata: {
      user_contact: {
        email: user.email,
        phone: user.phone,
        whatsapp_consent: user.whatsappConsent,
      },
    },
  });
  // Engage maneja Email, SMS (si aplica), WhatsApp (si consent)
  // Automáticamente.
}
```

**Cambios en código ProdeCaballito**:

- ✂️ Eliminar importes de `resend`, `infobip`, `twilio`
- ✂️ Eliminar env vars de estos proveedores
- ✂️ Eliminar lógica de template rendering (lo hace Engage)
- ✂️ Eliminar retry logic (lo hace Engage)
- ✂️ Simplificar a: "si pasa X → enviar evento a Engage"

**Líneas de código ahorradas**: ~500-1000 LOC

---

## 10. Checklist de Integración

### Pre-integración

- [ ] Crear API key en Engage admin
- [ ] Agregar env vars a ProdeCaballito (.env.local)
- [ ] Instalar cliente HTTP (axios, fetch, etc.)
- [ ] Leer este documento completo

### Integración Fase 1 (1 event type)

- [ ] Implementar `sendEvent()` en `src/lib/engage-client.ts`
- [ ] Reemplazar dispatcher de `prode.verification_code`
- [ ] Añadir feature flag `ENGAGE_ENABLED`
- [ ] Tests: enviar OTP, verificar en Engage dashboard
- [ ] Monitoreo: revisión manual en Bull Board

### Integración Fase 2 (5-10 event types)

- [ ] Mapear situaciones a event types
- [ ] Implementar `sendEvent()` para cada uno
- [ ] Tests end-to-end por event type
- [ ] Validar datos en `payload.business_context`
- [ ] Revisar métricas de entrega

### Integración Fase 3 (Completa)

- [ ] Todos los 26 event types implementados
- [ ] Eliminar código de fallback (si Engage es stable)
- [ ] Retirar integraciones directas a Resend, Infobip, Twilio SMS
- [ ] Cleanup: remover credenciales del .env
- [ ] Documentar en ProdeCaballito repo

### Post-integración (Mantenimiento)

- [ ] Monitorear alerts de Engage (delivery failures, etc.)
- [ ] Review mensual de métricas
- [ ] Actualizar templates si es necesario (en Engage)
- [ ] Comunicar cambios a usuarios si aplica

---

## 11. Preguntas Frecuentes

### P: ¿Qué pasa si no envío `whatsapp_consent`?

**R:** Engage asume `false` y NO envía WhatsApp. Siempre envía explícitamente desde ProdeCaballito.

### P: ¿Puedo enviar eventos en batch?

**R:** Sí, existe endpoint `POST /v1/events/batch` para hasta 1000 eventos por request.

### P: ¿Cuál es el límite de eventos/segundo?

**R:** 100 req/sec por tenant por defecto. Contactar admin si necesitas más.

### P: ¿Cómo replayo un evento?

**R:** Existe endpoint `POST /v1/events/{eventId}/replay` que crea una copia y re-enruta.

### P: ¿Puedo cambiar templates desde ProdeCaballito?

**R:** No en MVP. Templates se crean en Engage (`POST /v1/templates`). ProdeCaballito solo envía eventos.

### P: ¿Qué pasa con Web Push?

**R:** ProdeCaballito **mantiene su integración directa** con Firebase. Engage no cubre push en MVP.

### P: ¿Puedo ver logs de entrega?

**R:** Sí, `GET /v1/deliveries?eventId=xxx` o Bull Board en http://localhost:3002

---

## 12. Soporte

**Preguntas de Engage**: contactar admin o revisar docs en `/engage/docs`  
**Cambios en ProdeCaballito**: seguir este documento y usar feature flags  
**Issues de integración**: abrir issue en GitHub cfdelrio/engage

---

**Versión**: 1.0  
**Fecha**: 2026-05-21  
**Última revisión**: -
