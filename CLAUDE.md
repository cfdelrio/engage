# ORKESTAI ENGAGE — Guía para Claude

## Principios de desarrollo — OBLIGATORIOS

### 1. El sistema YA existe — solo extender

El proyecto tiene arquitectura funcionando: eventos, workers, integraciones, campañas, providers, reglas, Twilio, realtime, UI, deploy, CI/CD. **No reescribir. Extender.**

Antes de modificar cualquier módulo:

- Auditar código existente
- Revisar contratos actuales (APIs, queues, workers, schemas Prisma, providers)
- Identificar componentes reutilizables
- Proponer estrategia incremental

**No empezar codificando inmediatamente.**

### 2. No reemplazar — extender

Si ya existe worker / provider / queue / endpoint / event / schema / service / integration → **extender, no recrear**.

### 3. Backward compatibility siempre

Todo cambio debe preservar APIs, payloads, eventos y campañas existentes. Sin breaking changes innecesarios.

### 4. Reutilizar infraestructura existente

Usar lo que ya existe: BullMQ, Prisma, Fastify, websockets, providers, auth, tenants, analytics, queues, retry logic, event bus. **No duplicar lógica.**

### 5. Integración incremental

Feature flags si hace falta, módulos desacoplados, migraciones seguras, rollout progresivo.

### 6. Preservar datos y UX existentes

No borrar tablas, no cambiar contratos destructivamente, no resetear campañas, no invalidar eventos históricos. No rehacer navegación/dashboard/flows sin necesidad.

### 7. Cambios de DB siempre por migration — nunca por seed

Cualquier cambio de esquema o de datos en producción debe implementarse como un archivo de migration de Prisma en `packages/database/prisma/migrations/`, **no** modificando `seed.ts`. Las migrations corren automáticamente vía `migrate deploy` en cada deploy (ver `infra/scripts/restart-all.sh`). El seed es solo para datos iniciales en entornos nuevos — no es un mecanismo de actualización para producción.

---

## Arquitectura — Bounded Contexts

### ENGAGE es owner de:

- Usuarios, contactos, segmentación, consentimientos
- Frequency caps, quiet hours
- Campañas, reglas, analytics

### orkestai-voice es owner de:

- Voice flows, call execution, IVR, TTS
- Transcripts, DTMF, voice AI

**ENGAGE orquesta. orkestai-voice ejecuta.**

ENGAGE NO construye flows de voz — los flows ya existen en orkestai-voice. ENGAGE selecciona audiencia, aplica validaciones, dispara y trackea resultados.

### Payload de disparo de campaña de voz:

```json
{
  "engageCampaignId": "eng_123",
  "audience": [
    {
      "userId": "user_1",
      "phone": "+54911...",
      "variables": { "firstName": "Carlos", "rankingPosition": 2 }
    }
  ],
  "callbackUrl": "https://engage.orkestai.ar/api/webhooks/voice"
}
```

Los contactos SIEMPRE pertenecen a ENGAGE. No sincronizar contactos completos a orkestai-voice — enviarlos solo por ejecución.

### Validación antes de disparar campaña de voz:

- Consentimientos, unsubscribe, quiet hours
- Validez del teléfono, duplicados, country rules, frequency caps

### Webhooks de voz a ingestar:

`call.started`, `call.answered`, `call.completed`, `call.failed`, `call.busy`, `call.no_answer`, `dtmf.received`, `transcript.created`

---

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **API**: Fastify + TypeScript (puerto 3001)
- **Worker**: BullMQ + Redis
- **DB**: PostgreSQL 16 + Prisma
- **Frontend**: Next.js 15 (puerto 3000)
- **Infra local**: Docker Compose (Postgres + Redis)

## Git Workflow (Gitflow)

### Ramas principales

- **`main`** — código en **producción** (estable)
  - Solo mergea código desde `release/*` o `hotfix/*`
  - GitHub Actions auto-deploya a EC2 en cada push
- **`develop`** — rama de **integración** (pre-release)
  - Todas las features/bugfixes se mergean aquí
  - Staging/testing antes de liberar a producción

### Ramas de soporte

- **`feature/*`** — nuevas features (ej: `feature/campaigns-dashboard`)
  - Se crean desde `develop`
  - PR a `develop` (pasa CI, review, merge)
- **`bugfix/*`** — arreglos de bugs (ej: `bugfix/modal-overlap`)
  - Se crean desde `develop`
  - PR a `develop` (igual que features)
- **`hotfix/*`** — arreglos **críticos** en producción (ej: `hotfix/502-error`)
  - Se crean desde `main`
  - PR a `main` (urgent fixes, no espera release)
  - Se merge de vuelta a `develop`

### Flujo típico

```bash
# 1. Crear feature desde develop
git checkout develop && git pull origin develop
git checkout -b feature/new-feature

# 2. Hacer cambios, commits
git add . && git commit -m "mensaje"
git push -u origin feature/new-feature

# 3. Crear PR en GitHub → develop
# (CI corre automáticamente)
# (Review, fixes, merge)

# 4. Preparar release (cuando está listo)
git checkout develop && git pull origin develop
git checkout -b release/v1.2.0

# 5. Merge release a main (producción)
# (GitHub Actions auto-deploya a EC2)

# 6. Merge de vuelta a develop
```

### Reglas

- ✅ Todas las features **por PR a `develop`**
- ✅ Código **solo llega a producción vía `main`**
- ✅ GitHub Actions **auto-deploya en pushes a `main`**
- ✅ **Sin commits directos a `main` o `develop`** (siempre PR)

### Validación previa a pushear

Antes de hacer `git push`, correr validación completa localmente:

```bash
pnpm validate
```

Esto corre:

- `pnpm typecheck` — TypeScript strict mode (todos los paquetes)
- `pnpm lint` — turbo lint (web, core)
- `pnpm exec eslint packages apps --max-warnings 0` — ESLint en TODO el monorepo
- `pnpm test` — todas las pruebas (vitest)

Si alguno falla, arreglar antes de pushear. El pre-push hook también corre typecheck pero **`validate` es más exhaustivo** (incluye tests y lint completo).

## EC2 de producción

- **Path**: `/home/ec2-user/engage`
- **Branch**: `main` (auto-desplegado en cada push)
- **IP**: `44.199.212.116` (en DNS: `engage.orkestai.ar`)
- **Dashboard**: https://engage.orkestai.ar
- **API**: https://api.engage.orkestai.ar (subdominio dedicado, CNAME → engage.orkestai.ar)
- **Deploy**: GitHub Actions `deploy.yml` en cada push a `main` → `restart-all.sh`

### API Routing — Subdomain vs Path-Based

**Current (as of 2026-05-24)**: Vhost-based routing

- `https://engage.orkestai.ar` → Next.js dashboard (port 3000)
- `https://api.engage.orkestai.ar` → Fastify API (port 3001)

All API calls use the dedicated subdomain: `https://api.engage.orkestai.ar/v1/events`

Nginx config in `/etc/nginx/conf.d/orkestai.conf` routes by `server_name`, not path.

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

### Migración a Subdominio (ya completada)

Si necesitás reaplicar la migración de path-based (`/v1`) a subdomain (`api.`):

```bash
# En EC2:
cd /home/ec2-user/engage
bash infra/scripts/migrate-to-api-subdomain.sh engage.orkestai.ar

# Verifica que funcione:
curl -I https://api.engage.orkestai.ar/docs
```

El script:

- Actualiza certificado SSL para incluir `api.engage.orkestai.ar`
- Reconfiguración de Nginx con vhosts separados
- Reinicia el servicio web

**Cambios importantes para clientes externos:**

```bash
# OLD (path-based):
curl https://engage.orkestai.ar/v1/events

# NEW (subdomain-based):
curl https://api.engage.orkestai.ar/v1/events
```

### Build y Deploy en EC2

**Automático**: GitHub Actions dispara en cada push a `main`

```bash
# Script que ejecuta GitHub Actions:
bash infra/scripts/restart-all.sh
```

Si necesitás hacer cambios manuales (dev):

```bash
git fetch origin && git reset --hard origin/develop
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
