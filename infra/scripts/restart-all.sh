#!/bin/bash
set -eo pipefail

# ORKESTAI ENGAGE — Smart Restart Script
# Detects what changed since last deploy and only rebuilds what's needed
# Usage: ./infra/scripts/restart-all.sh

cd /home/ec2-user/engage || { echo "Change directory failed"; exit 1; }

echo "🔄 ORKESTAI ENGAGE — Smart restart..."

# 1. Load environment
echo "📋 Loading environment..."
if [ ! -f .env ]; then
  echo "  ✗ .env file not found at $(pwd)/.env — aborting"
  exit 1
fi
set -a; source .env; set +a

# Validate required env vars
REQUIRED_VARS=(DATABASE_URL REDIS_URL RESEND_API_KEY TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN PROVIDER_CONFIG_KEY)
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  [ -z "${!var}" ] && MISSING+=("$var")
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "  ⚠️  Missing env vars: ${MISSING[*]}"
  echo "  Services will start but channel delivery will fail — check .env"
else
  echo "  ✓ All required env vars present"
fi

# 2. Detect what changed since last successful deploy
LAST_DEPLOY=$(cat .last-deploy-commit 2>/dev/null || echo "")
CURRENT=$(git rev-parse HEAD)

# API and Worker always rebuild — builds are fast with turbo cache (~15s),
# and skipping risks deploying stale dist when only plugin/package files changed.
BUILD_API=true; BUILD_WORKER=true; BUILD_WEB=false; BUILD_INFRA=false

if [ -z "$LAST_DEPLOY" ]; then
  echo "  No previous deploy found — full rebuild"
  BUILD_WEB=true BUILD_INFRA=true
else
  CHANGED=$(git diff --name-only "$LAST_DEPLOY" "$CURRENT" 2>/dev/null || echo "")
  echo "  Changed since last deploy:"
  echo "$CHANGED" | sed 's/^/    /' | head -20

  while IFS= read -r file; do
    [[ "$file" =~ ^apps/web/ ]]        && BUILD_WEB=true
    [[ "$file" =~ ^infra/systemd/ ]]   && BUILD_INFRA=true
    [[ "$file" =~ ^packages/core/ ]]   && BUILD_WEB=true
    [[ "$file" =~ ^pnpm-lock\.yaml$ ]] && BUILD_WEB=true
  done <<< "$CHANGED"
fi

# Force rebuild web if dist missing
[ ! -d "apps/web/.next" ] && { echo "  ⚠️  Web dist missing — forcing rebuild"; BUILD_WEB=true; }

echo "  → API: $BUILD_API | Worker: $BUILD_WORKER | Web: $BUILD_WEB | Infra: $BUILD_INFRA"

# 3. Ensure Docker and databases are running
echo "🐳 Ensuring databases are up..."
sudo systemctl start docker 2>/dev/null || true
sleep 1
if docker compose version > /dev/null 2>&1; then
  docker compose up --detach postgres redis 2>/dev/null
elif command -v docker-compose > /dev/null 2>&1; then
  docker-compose up -d postgres redis 2>/dev/null
fi
echo -n "  Waiting for PostgreSQL..."
for i in $(seq 1 15); do
  if PGPASSWORD=engage psql -h localhost -U engage -d engage -c "SELECT 1" > /dev/null 2>&1; then
    echo " ready ✓"; break
  fi
  echo -n "."; sleep 2
done

# 4. Sync node_modules with lockfile (handles added/removed dependencies)
if $BUILD_API || $BUILD_WORKER || $BUILD_WEB; then
  echo "📦 Installing dependencies..."
  pnpm install --frozen-lockfile 2>&1 | tail -5
  echo "  ✓ Dependencies up to date"
  echo "  Generating Prisma client..."
  pnpm --filter @engage/database db:generate 2>&1 | tail -3
  echo "  ✓ Prisma client generated"
  echo "  Syncing database schema (migrate deploy)..."
  if pnpm --filter @engage/database db:migrate:deploy 2>&1 | tail -5; then
    echo "  ✓ Migrations applied"
  else
    echo "  ⚠️  migrate deploy failed — falling back to db push (adds missing tables, never drops)"
    pnpm --filter @engage/database exec prisma db push --skip-generate 2>&1 | tail -5 || true
    echo "  ✓ db push completed"
  fi
fi

# 6. Stop only affected services
echo "🛑 Stopping affected services..."
$BUILD_API    && sudo systemctl stop orkestai-api    2>/dev/null || true
$BUILD_WORKER && sudo systemctl stop orkestai-worker 2>/dev/null || true
$BUILD_WEB    && sudo systemctl stop orkestai-web    2>/dev/null || true
sleep 2

# 7. Build only what changed
if $BUILD_API; then
  echo "🏗️  Building API..."
  rm -rf apps/api/dist
  pnpm --filter @engage/api... run build 2>&1 | tail -10
  if [ ! -f "apps/api/dist/index.js" ]; then
    echo "✗ API build failed — dist/index.js not found"; exit 1
  fi
  echo "  ✓ API build OK"
fi

if $BUILD_WORKER; then
  echo "🏗️  Building Worker..."
  rm -rf apps/worker/dist
  pnpm --filter @engage/worker... run build 2>&1 | tail -10
  if [ ! -f "apps/worker/dist/index.js" ]; then
    echo "✗ Worker build failed — dist/index.js not found"; exit 1
  fi
  echo "  ✓ Worker build OK"
fi

if $BUILD_WEB; then
  echo "🏗️  Building Web..."
  rm -rf apps/web/.next
  rm -rf .turbo/cache/*web* 2>/dev/null || true
  pnpm --filter @engage/web run build 2>&1 | tail -10
  if [ ! -d "apps/web/.next" ]; then
    echo "✗ Web build failed"; exit 1
  fi
  echo "  ✓ Web build OK"
fi

# 8. Update systemd services if infra changed
if $BUILD_INFRA || [ -z "$LAST_DEPLOY" ]; then
  echo "📦 Updating systemd services..."
  sudo cp infra/systemd/orkestai-api.service /etc/systemd/system/
  sudo cp infra/systemd/orkestai-worker.service /etc/systemd/system/
  sudo cp infra/systemd/orkestai-web.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable orkestai-api orkestai-worker orkestai-web 2>/dev/null
  # If infra changed, restart all services
  BUILD_API=true; BUILD_WORKER=true; BUILD_WEB=true
fi

# 9. Start affected services
echo "🚀 Starting services..."
if $BUILD_API; then
  # Kill any stale process holding port 3001 (e.g. a manually-started node instance)
  fuser -k 3001/tcp 2>/dev/null || true; sleep 1
  sudo systemctl start orkestai-api; sleep 3
fi
if $BUILD_WORKER; then
  sudo systemctl start orkestai-worker; sleep 2
fi
if $BUILD_WEB; then
  sudo systemctl start orkestai-web; sleep 4
fi

# 10. Save current commit as last deploy
echo "$CURRENT" > .last-deploy-commit

# 11. Health checks — solo para servicios que fueron (re)iniciados
echo "🏥 Health checks..."
if ! $BUILD_API && ! $BUILD_WEB; then
  echo "  No services restarted — skipping health checks"
else
  if $BUILD_API; then
    echo -n "  Waiting for API..."
    for i in $(seq 1 20); do
      if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo " ✓ API healthy"; break
      fi
      if [ "$i" -eq 20 ]; then
        echo " ✗ API not responding after 40s"
        sudo journalctl -u orkestai-api -n 50 --no-pager
        exit 1
      fi
      echo -n "."; sleep 2
    done
  fi
  if $BUILD_WEB; then
    echo -n "  Waiting for Web..."
    for i in $(seq 1 20); do
      if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo " ✓ Web responding"; break
      fi
      if [ "$i" -eq 20 ]; then
        echo " ✗ Web not responding after 40s"
        sudo journalctl -u orkestai-web -n 50 --no-pager
        exit 1
      fi
      echo -n "."; sleep 2
    done
  fi
fi

echo ""
echo "🔁 Restart individual: sudo systemctl restart orkestai-web"
echo "🌐 https://engage.orkestai.ar"
