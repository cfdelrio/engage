#!/bin/bash
set -e

echo "🚀 ORKESTAI Deploy - Selective"

cd /home/ec2-user/engage

# Fetch latest
git fetch origin main
git pull origin main

# Detect what changed (compare with previous HEAD)
echo "📝 Detecting changes..."
CHANGED=$(git diff HEAD~1 HEAD --name-only 2>/dev/null || echo "")

if [ -z "$CHANGED" ]; then
  echo "⚠️  No changes detected. Exiting."
  exit 0
fi

echo "Changed files:"
echo "$CHANGED"

# Determine what to build/deploy
BUILD_API=false
BUILD_WEB=false
BUILD_WORKER=false

# API/Worker: changes in apps/api, apps/worker, packages/* (except core themes)
[[ "$CHANGED" =~ ^apps/api/ || "$CHANGED" =~ ^packages/(ai|channels|event-bus|rules-engine|analytics|database) ]] && BUILD_API=true
[[ "$CHANGED" =~ ^apps/worker/ || "$CHANGED" =~ ^packages/(ai|event-bus|rules-engine|analytics|database) ]] && BUILD_WORKER=true

# Web: changes in apps/web, packages/core (shared types)
[[ "$CHANGED" =~ ^apps/web/ || "$CHANGED" =~ ^packages/core ]] && BUILD_WEB=true

echo ""
echo "Build plan:"
echo "  API:    ${BUILD_API}"
echo "  Web:    ${BUILD_WEB}"
echo "  Worker: ${BUILD_WORKER}"
echo ""

# Always generate DB types
pnpm --filter @engage/database db:generate

# Build shared packages (always needed)
pnpm --filter @engage/core build
pnpm --filter @engage/ai build

# Build selective targets
if [ "$BUILD_API" = true ]; then
  echo "🔨 Building API..."
  pnpm --filter @engage/api build
fi

if [ "$BUILD_WEB" = true ]; then
  echo "🔨 Building Web..."
  pnpm --filter @engage/web build
  echo "📦 Staging static assets..."
  cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static 2>/dev/null || true
  cp -r apps/web/public apps/web/.next/standalone/apps/web/public 2>/dev/null || true
fi

if [ "$BUILD_WORKER" = true ]; then
  echo "🔨 Building Worker..."
  pnpm --filter @engage/worker build
fi

# Restart only modified services
echo ""
echo "🔄 Restarting services..."

if [ "$BUILD_API" = true ]; then
  echo "  Restarting API..."
  sudo systemctl restart orkestai-api
fi

if [ "$BUILD_WEB" = true ]; then
  echo "  Restarting Web..."
  sudo systemctl stop orkestai-web || true
  sudo fuser -k 3000/tcp 2>/dev/null || true
  sudo systemctl restart orkestai-web
fi

if [ "$BUILD_WORKER" = true ]; then
  echo "  Restarting Worker..."
  sudo systemctl restart orkestai-worker
fi

echo ""
echo "✅ Deploy complete!"
echo ""
echo "Services status:"
sudo systemctl status orkestai-api orkestai-web orkestai-worker --no-pager 2>/dev/null | grep -E "Active:|● orkestai"
