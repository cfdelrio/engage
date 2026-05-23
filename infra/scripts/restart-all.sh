#!/bin/bash
set -e

# ORKESTAI ENGAGE — Restart All Services Script
# Usage: ./infra/scripts/restart-all.sh
# Handles: env loading, clean kills, full rebuild, fresh start

cd /home/ec2-user/engage || { echo "Change directory failed"; exit 1; }

echo "🔄 ORKESTAI ENGAGE — Restarting all services..."

# 1. Load environment
echo "📋 Loading environment..."
set -a
source .env
set +a

# 2. Kill existing processes gracefully
echo "🛑 Stopping existing services..."
pkill -f "apps/worker/dist/index.js" 2>/dev/null || true
pkill -f "apps/api/dist/index.js" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 3001/tcp 2>/dev/null || true
sleep 2

# 3. Clean caches
echo "🗑️  Cleaning caches..."
rm -rf apps/web/.next
rm -rf apps/api/dist
rm -rf apps/worker/dist

# 4. Full rebuild
echo "🏗️  Building all apps..."
pnpm build 2>&1 | tail -20

# 5. Start services in order
echo "🚀 Starting services..."

# API first (needed by worker and web)
echo "  → Starting API on port 3001..."
NODE_ENV=production node apps/api/dist/index.js >> ~/api.log 2>&1 &
API_PID=$!
sleep 3

# Worker
echo "  → Starting Worker..."
NODE_ENV=production node apps/worker/dist/index.js >> ~/worker.log 2>&1 &
WORKER_PID=$!
sleep 2

# Web (Next.js)
echo "  → Starting Web on port 3000..."
cd apps/web && NODE_ENV=production node_modules/.bin/next start >> ~/web.log 2>&1 &
WEB_PID=$!
cd /home/ec2-user/engage
sleep 3

# 6. Verify all running
echo "✅ Services started (PIDs: API=$API_PID, Worker=$WORKER_PID, Web=$WEB_PID)"

# 7. Quick health checks
echo "🏥 Health checks..."
if curl -s http://localhost:3001/health > /dev/null; then
  echo "  ✓ API healthy"
else
  echo "  ✗ API not responding"
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "  ✓ Web responding"
else
  echo "  ✗ Web not responding"
fi

echo ""
echo "📊 Logs available at:"
echo "  - API:    tail -f ~/api.log"
echo "  - Worker: tail -f ~/worker.log"
echo "  - Web:    tail -f ~/web.log"
echo ""
echo "🌐 Access at: https://engage.orkestai.ar"
