# Getting Started — ORKESTAI ENGAGE

Guía rápida para developers nuevos.

---

## 1. Clonar y Setup (5 minutos)

```bash
# Clonar repo
git clone https://github.com/cfdelrio/engage.git
cd engage

# Instalar dependencias
pnpm install

# Levantar infraestructura (Postgres + Redis + Bull Board)
docker compose up -d

# Verificar que está corriendo
docker compose ps

# Ver logs
docker compose logs -f postgres
```

---

## 2. Database Setup (3 minutos)

```bash
# Generar cliente Prisma
pnpm db:generate

# Correr migraciones
pnpm db:migrate:dev

# Seed: crea tenant ProdeCaballito + datos de prueba
pnpm db:seed

# Verificar datos en DB
psql postgresql://engage:engage@localhost:5432/engage
```

En psql:
```sql
SELECT id, slug, name FROM "Tenant";
SELECT id, keyPrefix, name FROM "TenantApiKey";
```

---

## 3. Levantar Servicios (2 minutos)

En terminal separada:

```bash
# Levanta API (3001), Worker (background), Web (3000), Bull Board (3002)
pnpm dev
```

Esperar logs:
```
api:      ✓ Server listening on http://localhost:3001
web:      ✓ Ready in 2.5s
worker:   ✓ Workers started for: events.incoming, ...
bullboard: ✓ Listening on http://localhost:3002
```

---

## 4. Verificar Setup

### Accesos

| URL | Descripción |
|-----|-------------|
| http://localhost:3000 | Dashboard (admin) |
| http://localhost:3001/docs | Swagger API docs |
| http://localhost:3002 | Bull Board (job monitoring) |

### Obtener API Key

```bash
# La API key se imprime en stdout durante seed
# Si no la ves, verificar en DB
psql postgresql://engage:engage@localhost:5432/engage
SELECT keyHash, keyPrefix FROM "TenantApiKey" LIMIT 1;

# O regenerar una nueva en el dashboard: Settings → API Keys
```

### Test básico

```bash
# Guardar tu API key
export API_KEY="pk_test_..."

# Ingestar un evento
curl -X POST http://localhost:3001/v1/events \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "prode.ranking.changed",
    "userId": "user_123",
    "payload": { "newRank": 1 }
  }'

# Esperado: 202 { "eventId": "...", "status": "queued" }
```

---

## 5. Estructura del Código

```
engage/
├── apps/
│   ├── api/          # Fastify REST API
│   │   └── src/routes/voice.ts    ← Endpoints de voice campaigns
│   │
│   ├── web/          # Next.js dashboard
│   │   └── src/app/(dashboard)/voice-campaigns/  ← UI de voice
│   │
│   └── worker/       # BullMQ workers
│       └── src/processors/voice-calls.ts  ← Twilio integration
│
├── packages/
│   ├── core/         # Tipos, constantes, utils
│   ├── database/     # Prisma schema + migrations
│   │   └── prisma/schema.prisma  ← VoiceCampaign, VoiceCall
│   │
│   ├── channels/     # Provider implementations
│   │   └── src/providers/twilio-voice.ts  ← Voice provider
│   │
│   └── ai/           # AI orchestration
│       └── src/voice-generator.ts  ← Voice AI utilities
│
└── docker-compose.yml  # Local infrastructure
```

---

## 6. Crear Campaña de Voz (Mi Primera Feature)

### Vía Swagger

1. Ir a http://localhost:3001/docs
2. Buscar `POST /v1/voice-campaigns`
3. Click "Try it out"
4. Ingresar body:
```json
{
  "name": "Mi Primera Campaña",
  "script": "Hola {{user.firstName}}, bienvenido!",
  "voiceConfig": {
    "language": "es-ES",
    "voice": "female"
  }
}
```
5. Click "Execute"

### Vía cURL

```bash
curl -X POST http://localhost:3001/v1/voice-campaigns \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi Primera Campaña",
    "script": "Hola {{user.firstName}}, bienvenido!",
    "voiceConfig": {
      "language": "es-ES",
      "voice": "female"
    }
  }' | jq .

# Guardar el campaign ID
export CAMPAIGN_ID="camp_..."
```

### Ver en Dashboard

1. Ir a http://localhost:3000/voice-campaigns
2. Ver la campaña creada
3. Click para ver detalles

---

## 7. Troubleshooting

### "Cannot find module '@engage/database'"

**Causa:** Prisma client no generado

**Solución:**
```bash
pnpm db:generate
pnpm install
```

### "ECONNREFUSED 127.0.0.1:5432"

**Causa:** PostgreSQL no está corriendo

**Solución:**
```bash
docker compose up -d postgres
docker compose logs -f postgres
```

### "Worker no está procesando jobs"

**Causa:** Worker no está ejecutándose

**Solución:**
```bash
# Verificar que pnpm dev está corriendo
# Si está, verificar logs:
pnpm dev 2>&1 | grep -i worker

# O abrir otra terminal y verificar procesos:
ps aux | grep node
```

### "Bull Board muestra queues vacías"

**Causa:** Redis no está conectado correctamente

**Solución:**
```bash
redis-cli PING
# Expected: PONG

# Si falla, reiniciar Redis:
docker compose restart redis
```

---

## 8. Primeros Cambios

### Cambiar una constante

1. Editar `packages/core/src/constants/feature-flags.ts`
2. Cambiar `VOICE_CAMPAIGNS: 'voice_campaigns'`
3. Regenerar tipos: `pnpm typecheck`
4. Ver el error → arreglarlo

### Agregar un endpoint

1. Crear función en `apps/api/src/routes/voice.ts`
2. Registrar ruta: `fastify.post('/v1/voice-campaigns/...')`
3. Ir a Swagger y verificar que aparezca

### Cambiar el schema Prisma

1. Editar `packages/database/prisma/schema.prisma`
2. Crear migración: `pnpm db:migrate:dev --name descripcion`
3. Se ejecuta automáticamente en dev
4. Regenerar client: `pnpm db:generate`

---

## 9. Comandos Útiles

```bash
# Development
pnpm dev                  # Todos los servicios
pnpm api:dev              # Solo API
pnpm web:dev              # Solo web dashboard
pnpm worker:dev           # Solo worker

# Database
pnpm db:generate          # Regenerar Prisma client
pnpm db:migrate:dev       # Nueva migración
pnpm db:push              # Push a remote DB (prod)
pnpm db:seed              # Reset + seed con datos

# Quality
pnpm typecheck            # TypeScript check
pnpm lint                 # ESLint
pnpm test                 # Run tests (cuando existan)
pnpm build                # Build para producción

# Monorepo
pnpm --filter @engage/database db:generate
pnpm --filter @engage/api typecheck
pnpm --filter @engage/web lint

# Git
git checkout claude/event-driven-engagement-platform-Bl7PI  # Dev branch
git push -u origin <branch>
```

---

## 10. Próximos Pasos

1. **Leer la documentación:**
   - [ARCHITECTURE.md](/ARCHITECTURE.md) — Overview de todo
   - [VOICE_CAMPAIGNS.md](/VOICE_CAMPAIGNS.md) — Deep dive en voice

2. **Explorar el código:**
   - Seguir un request de evento desde API → Worker → DB
   - Ver cómo se procesa un rule en `packages/rules-engine`
   - Revisar cómo se mandan emails vs voice calls

3. **Hacer cambios pequeños:**
   - Agregar variable nueva a templates
   - Cambiar un status map en webhook handler
   - Agregar un tipo nuevo en `packages/core/types`

4. **Revisar tests:**
   - [TEST_PLAN.md](/TEST_PLAN.md) — Estrategia
   - Cuando haya test suite, verlos como ejemplos de uso

5. **Deploy local:**
   - Cambiar `.env` a datos reales (Twilio, etc.)
   - Test end-to-end de una campaña real
   - Verificar en DB que todo se guardó

---

## 11. Contacto & Help

- **Preguntas sobre arquitectura:** Ver [ARCHITECTURE.md](/ARCHITECTURE.md)
- **Problemas con setup:** Ver [Troubleshooting](#7-troubleshooting)
- **Referencia de API:** [API_REFERENCE.md](/API_REFERENCE.md)
- **DeployIssues:** [infra/DEPLOYMENT.md](/infra/DEPLOYMENT.md)

---

## Checklista de Setup ✅

- [ ] `pnpm install` completado
- [ ] `docker compose up -d` y servicios corriendo
- [ ] `pnpm db:migrate:dev && pnpm db:seed` ejecutados
- [ ] `pnpm dev` corriendo (API, Web, Worker, Bull Board)
- [ ] Puedo acceder a http://localhost:3000 (dashboard)
- [ ] Puedo hacer POST a `/v1/events` y ver evento en DB
- [ ] Puedo crear campaña de voz vía Swagger
- [ ] Entiendo la estructura del monorepo
- [ ] Leí ARCHITECTURE.md (primeros 3 minutos)

**¡Felicidades, estás listo para desarrollar!** 🚀
