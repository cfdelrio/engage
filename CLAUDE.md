# ORKESTAI ENGAGE — Guía para Claude

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
- **IP**: `44.223.7.160` (https://engage.orkestai.ar)
- **Deploy**: GitHub Actions `deploy.yml` en cada push a `main` → `restart-all.sh`

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

## Lecciones aprendidas

### 1. `set -eo pipefail` + `cmd | tail -N` silencia errores reales

`cmd | tail -5` siempre retorna exit code 0 (el de `tail`). Con `set -eo pipefail` el pipeline en sí no falla aunque `cmd` falle internamente. Errores críticos pasan desapercibidos y el script continúa.

**Regla:** Nunca silenciar comandos críticos con `| tail`. Usar `if/else` explícito o capturar el output en una variable.

```bash
# MAL — error de migrate deploy se swallow
pnpm db:migrate:deploy 2>&1 | tail -5

# BIEN — falla explícita con fallback
if pnpm db:migrate:deploy 2>&1 | tail -5; then
  echo "ok"
else
  pnpm exec prisma db push --skip-generate || true
fi
```

### 2. Los headers hop-by-hop no se deben forwardear en proxies HTTP

`Connection`, `Keep-Alive`, `Transfer-Encoding`, `Upgrade`, etc. son headers de transporte entre dos nodos, no end-to-end. nginx los agrega al traducir HTTP/2 → HTTP/1.1. Si el proxy de Next.js los forwardea al fetch upstream, `undici` los rechaza con `UND_ERR_INVALID_ARG`.

**Regla:** Todo proxy HTTP debe filtrar hop-by-hop headers antes del fetch upstream:

```typescript
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization",
]);
request.headers.forEach((value, key) => {
  if (!HOP_BY_HOP.has(key) && key !== "host" && key !== "cookie")
    headers.set(key, value);
});
```

### 3. `systemctl stop` no mata procesos iniciados manualmente

Si alguien arrancó el API con `node dist/index.js &`, `systemctl stop orkestai-api` solo detiene el proceso de systemd. El proceso manual sigue corriendo en el puerto. Al próximo `systemctl start` → `EADDRINUSE` → crash loop.

**Regla:** Antes de `systemctl start` para un servicio con puerto fijo, matar lo que esté en ese puerto:

```bash
fuser -k 3001/tcp 2>/dev/null || true
sudo systemctl start orkestai-api
```

Nunca mezclar arranque manual y systemd para el mismo servicio.

### 4. `z.string().email().optional()` rechaza `""` (string vacío)

`.optional()` acepta `undefined` pero NO `""`. Los forms de React con `defaultValues: { fromEmail: "" }` siempre mandan string vacío en el submit. El servidor recibe `""`, Zod falla la validación de `.email()` → ZodError → 500.

**Regla:** En schemas Zod del servidor, normalizar string vacío a `undefined` antes de validar formato:

```typescript
fromEmail: z.preprocess(v => (v === "" ? undefined : v), z.string().email().optional()),
```

Aplica a cualquier campo con validación de formato (`.email()`, `.url()`, `.uuid()`) que el frontend puede mandar como string vacío.

### 5. El turbo cache puede mostrar CI verde con código roto

Si el primer run de CI falla pero hay un segundo run (ej: push trigger + PR trigger simultáneos), el segundo puede ser 100% cache hit y mostrar verde aunque el código real no compila. Los checks "18 cached, 18 total" en un PR merecen desconfianza si hubo un run fallido previo.

**Regla:** Ante la duda, invalidar el cache o verificar que al menos un run compiló desde cero.

## Seed

```bash
set -a; source .env; set +a
pnpm --filter @engage/database db:seed
```

Crea: 26 EventDefinitions, 37 Templates, 26 Rules, 1 Tenant (prodecaballito).
Nota: los `channel_providers` del seed solo crean `email:resend`. Los demás se insertan por SQL (ver arriba).
