# ORKESTAI ENGAGE — Guía para Claude

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **API**: Fastify + TypeScript (puerto 3001)
- **Worker**: BullMQ + Redis
- **DB**: PostgreSQL 16 + Prisma
- **Frontend**: Next.js 15 (puerto 3000)
- **Infra local**: Docker Compose (Postgres + Redis)

## EC2 de producción

- **Path**: `/home/ec2-user/engage`
- **Branch**: `claude/event-driven-engagement-platform-Bl7PI`
- **IP**: `44.223.7.160` (engage.orkestai.ar)

### Iniciar servicios en EC2

```bash
# Siempre cargar .env antes de iniciar
set -a; source .env; set +a

# Worker
pkill -f "apps/worker/dist/index.js" 2>/dev/null; sleep 2
NODE_ENV=production node apps/worker/dist/index.js >> ~/worker.log 2>&1 &

# API
fuser -k 3001/tcp 2>/dev/null; sleep 2
NODE_ENV=production node apps/api/dist/index.js >> ~/api.log 2>&1 &
```

### Build en EC2

```bash
git fetch origin && git reset --hard origin/claude/event-driven-engagement-platform-Bl7PI
pnpm build   # turbo build completo
# O por paquete específico (sin --force):
pnpm --filter @engage/channels run build
pnpm --filter @engage/worker run build
pnpm --filter @engage/api run build
```

> **IMPORTANTE**: nunca usar `pnpm build --force` — pasa `--force` a `tsc` que no lo soporta.

### Verificar logs

```bash
tail -20 ~/worker.log
tail -20 ~/api.log
```

### Puerto 3001 ocupado

Si el API no arranca por `EADDRINUSE`:

```bash
fuser -k 3001/tcp 2>/dev/null
sleep 2
```

`pkill -9 node` a veces no libera el puerto a tiempo — `fuser -k` es más confiable.

### PostgreSQL

```bash
PGPASSWORD=engage psql -h localhost -U engage -d engage
```

## Variables de entorno (.env)

| Variable                      | Descripción                                                      |
| ----------------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`                | PostgreSQL connection string                                     |
| `REDIS_URL`                   | Redis connection string                                          |
| `RESEND_API_KEY`              | API key de Resend (email)                                        |
| `RESEND_FROM_EMAIL`           | From address verificado (ej: `notifications@prodecaballito.com`) |
| `INFOBIP_API_KEY`             | API key de Infobip (SMS)                                         |
| `INFOBIP_BASE_URL`            | Base URL de Infobip (ej: `https://XXXX.api.infobip.com`)         |
| `INFOBIP_SMS_FROM`            | Sender ID de Infobip (ej: `14198089784`)                         |
| `TWILIO_ACCOUNT_SID`          | Account SID de Twilio                                            |
| `TWILIO_AUTH_TOKEN`           | Auth Token de Twilio                                             |
| `TWILIO_FROM_NUMBER`          | Número Twilio para voz (E.164)                                   |
| `TWILIO_WHATSAPP_FROM_NUMBER` | Número WhatsApp (`+14155238886` para sandbox)                    |
| `ANTHROPIC_API_KEY`           | API key de Anthropic (AI layer)                                  |
| `API_BASE_URL`                | URL pública del API (para webhooks de Twilio)                    |

## Channel Providers en DB

Los providers deben estar en la tabla `channel_providers` con `isActive=true, isDefault=true`.

Estado actual:

| channel  | provider        |
| -------- | --------------- |
| email    | resend          |
| sms      | infobip_sms     |
| whatsapp | twilio-whatsapp |
| voice    | twilio_voice    |
| push     | firebase_fcm    |

Si falta alguno, insertarlo:

```sql
INSERT INTO channel_providers (id, "tenantId", channel, provider, "isActive", "isDefault", "configEncrypted", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t.id, 'sms', 'infobip_sms', true, true, '{}', now(), now()
FROM tenants t WHERE t.slug = 'prodecaballito'
ON CONFLICT ("tenantId", channel, provider) DO UPDATE SET "isActive" = true, "isDefault" = true;
```

## Channel Providers — providerName vs DB

| Canal    | `providerName` en código | `provider` en DB  |
| -------- | ------------------------ | ----------------- |
| email    | `resend`                 | `resend`          |
| sms      | `infobip_sms`            | `infobip_sms`     |
| whatsapp | `twilio-whatsapp`        | `twilio-whatsapp` |
| voice    | `twilio_voice`           | `twilio_voice`    |
| push     | `firebase_fcm`           | `firebase_fcm`    |

## Worker startup — diagnóstico

Al iniciar, el worker imprime:

```
[worker] Channel providers registered: email:resend, sms:infobip_sms, ...
```

Si dice `WARNING: No channel providers registered` → alguna variable de entorno falta.

Al procesar cada delivery:

```
[channel-delivery] job=X channel=email providerName=resend registryKeys=["email:resend"] attempt=0
```

Si `registryKeys=[]` → el worker arrancó sin las env vars.

## Tenant de prueba

- **Slug**: `prodecaballito`
- **API Key**: `oek_9vf62jr5n6gc4edpvxl28p`

### Test rápido end-to-end

```bash
curl -s -X POST http://localhost:3001/v1/events \
  -H "x-api-key: oek_9vf62jr5n6gc4edpvxl28p" \
  -H "content-type: application/json" \
  -d '{
    "type": "prode.result_published.individual",
    "userId": "test_001",
    "idempotencyKey": "test_001_unique",
    "payload": {"business_context": {"outcome": "exacto", "match": {"local": "Argentina", "away": "Brasil"}}},
    "metadata": {"user_contact": {"email": "info@orkestai.com.ar", "phone": "+5491155996222", "whatsapp_consent": true}}
  }'
```

Verificar resultado:

```bash
PGPASSWORD=engage psql -h localhost -U engage -d engage -c "
SELECT d.channel, d.provider, d.status, d.\"providerMessageId\", d.\"failureReason\"
FROM deliveries d JOIN users u ON d.\"userId\" = u.id
WHERE u.\"externalId\" = 'test_001';"
```

## Problemas conocidos y soluciones

| Problema                                 | Causa                                         | Solución                                                   |
| ---------------------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `No provider found`                      | Worker arrancó sin env vars                   | `set -a; source .env; set +a` antes de iniciar             |
| `EADDRINUSE 3001`                        | API vieja sigue corriendo                     | `fuser -k 3001/tcp`                                        |
| `domain is not verified` (Resend)        | `RESEND_FROM_EMAIL` usa dominio no verificado | Verificar dominio en resend.com/domains                    |
| `not SMS-capable` (Twilio)               | Número Twilio no soporta SMS                  | Usar Infobip para SMS                                      |
| `statusCallback URL undefined`           | `API_BASE_URL` no seteado                     | Es opcional — el env var hace que se omita automáticamente |
| Evento deduplicado                       | Mismo `idempotencyKey`                        | Cambiar `idempotencyKey` en cada test                      |
| `tsc --force` error                      | `pnpm build --force` pasa flag a tsc          | Usar `pnpm run build` sin `--force`                        |
| psql auth falla después de `source .env` | `.env` exporta PGPASSWORD incorrecto          | Usar `PGPASSWORD=engage psql ...` explícito                |

## Seed

```bash
set -a; source .env; set +a
pnpm --filter @engage/database db:seed
```

Crea: 26 EventDefinitions, 37 Templates, 26 Rules, 1 Tenant (prodecaballito).
Nota: los `channel_providers` del seed solo crean `email:resend`. Los demás se insertan por SQL (ver arriba).
