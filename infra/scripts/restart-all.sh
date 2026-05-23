#!/bin/bash
set -e

# ORKESTAI ENGAGE — Restart All Services Script
# Usage: ./infra/scripts/restart-all.sh
# Uses systemd for reliable process management

cd /home/ec2-user/engage || { echo "Change directory failed"; exit 1; }

echo "🔄 ORKESTAI ENGAGE — Restarting all services..."

# 1. Load environment for the build
echo "📋 Loading environment..."
set -a
source .env
set +a

# 2. Stop services via systemd (no port conflicts possible)
echo "🛑 Stopping services..."
sudo systemctl stop orkestai-web orkestai-worker orkestai-api 2>/dev/null || true
sleep 2

# 3. Ensure Docker and databases are running
echo "🐳 Starting Docker and databases..."
sudo systemctl start docker 2>/dev/null || true
sleep 2
# Support both docker compose v2 and docker-compose v1
if docker compose version > /dev/null 2>&1; then
  docker compose up --detach postgres redis
elif command -v docker-compose > /dev/null 2>&1; then
  docker-compose up -d postgres redis
else
  echo "  ⚠ docker compose not found, assuming DB already running"
fi
echo -n "  Waiting for PostgreSQL..."
for i in $(seq 1 15); do
  if PGPASSWORD=engage psql -h localhost -U engage -d engage -c "SELECT 1" > /dev/null 2>&1; then
    echo " ready ✓"
    break
  fi
  echo -n "."
  sleep 2
done

# 4. Clean caches
echo "🗑️  Cleaning caches..."
rm -rf apps/web/.next
rm -rf apps/api/dist
rm -rf apps/worker/dist
# Clear turbo cache for web to prevent stale cache from skipping the build
rm -rf .turbo/cache/*web* 2>/dev/null || true

# 5. Full rebuild (API + Worker via turbo, Web always fresh)
echo "🏗️  Building API and Worker..."
pnpm --filter @engage/api --filter @engage/worker --filter @engage/database --filter @engage/core --filter @engage/channels --filter @engage/event-bus --filter @engage/rules-engine --filter @engage/ai --filter @engage/analytics run build 2>&1 | tail -10

echo "🏗️  Building Web (fresh, no cache)..."
pnpm --filter @engage/web run build 2>&1 | tail -20

# Verify .next was created
if [ ! -d "apps/web/.next" ]; then
  echo "✗ Web build failed — .next directory not found"
  exit 1
fi
echo "  ✓ Web build OK"

# 5. Install/update systemd service files
echo "📦 Installing systemd services..."
sudo cp infra/systemd/orkestai-api.service /etc/systemd/system/
sudo cp infra/systemd/orkestai-worker.service /etc/systemd/system/
sudo cp infra/systemd/orkestai-web.service /etc/systemd/system/
sudo systemctl daemon-reload

# 6. Start services via systemd
echo "🚀 Starting services..."
sudo systemctl start orkestai-api
sleep 3
sudo systemctl start orkestai-worker
sleep 2
sudo systemctl start orkestai-web
sleep 4

# 7. Enable on boot
sudo systemctl enable orkestai-api orkestai-worker orkestai-web 2>/dev/null

# 8. Health checks
echo "🏥 Health checks..."
if curl -s http://localhost:3001/health > /dev/null; then
  echo "  ✓ API healthy"
else
  echo "  ✗ API not responding — check: sudo journalctl -u orkestai-api -n 20"
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "  ✓ Web responding"
else
  echo "  ✗ Web not responding — check: sudo journalctl -u orkestai-web -n 20"
fi

echo ""
echo "📊 Logs:"
echo "  sudo journalctl -u orkestai-api -f"
echo "  sudo journalctl -u orkestai-worker -f"
echo "  sudo journalctl -u orkestai-web -f"
echo ""
echo "🔁 Para reiniciar un servicio: sudo systemctl restart orkestai-web"
echo "🌐 Access at: https://engage.orkestai.ar"
