#!/bin/bash

set -e

echo "🚀 ORKESTAI ENGAGE — EC2 Setup Script"
echo "======================================"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "❌ Don't run this script as root. Run as ec2-user:"
  echo "   sudo -u ec2-user bash scripts/setup-ec2.sh"
  exit 1
fi

# Set variables
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_DIR/.env"

echo "📁 Repository: $REPO_DIR"

# Create .env if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
  echo "📝 Creating .env file..."
  cat > "$ENV_FILE" << 'EOF'
# Database
DATABASE_URL="postgresql://engage:engage@localhost:5432/engage"
SHADOW_DATABASE_URL="postgresql://engage:engage@localhost:5433/engage_shadow"

# Redis
REDIS_URL="redis://localhost:6379"

# API
API_PORT=3001
API_JWT_SECRET="dev-secret-this-must-be-at-least-32-chars-long-for-production"
ENCRYPTION_KEY="dev-key-this-must-be-exactly-32-bytes-for-aes-256!"

# Node environment
NODE_ENV=production

# AI Providers (add your keys)
AI_DEFAULT_PROVIDER="anthropic"
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""

# Channel Providers
RESEND_API_KEY=""
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""
TWILIO_WHATSAPP_FROM=""

# Frontend
NEXT_PUBLIC_API_URL="http://$(hostname -I | awk '{print $1}'):3001"
NEXT_PUBLIC_WS_URL="ws://$(hostname -I | awk '{print $1}'):3001"
NEXTAUTH_SECRET="dev-secret-change-in-production"
NEXTAUTH_URL="http://$(hostname -I | awk '{print $1}'):3000"
EOF
  echo "✅ .env created"
fi

# Load environment
echo "🔧 Loading environment variables..."
export $(grep -v '^#' "$ENV_FILE" | xargs)

# Start Docker Compose
echo "🐳 Starting Docker Compose services..."
cd "$REPO_DIR"
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
for i in {1..30}; do
  if pg_isready -h localhost -U engage &>/dev/null; then
    echo "✅ PostgreSQL is ready"
    break
  fi
  echo "   Attempt $i/30..."
  sleep 2
done

# Wait for Redis to be ready
echo "⏳ Waiting for Redis..."
for i in {1..30}; do
  if redis-cli ping &>/dev/null; then
    echo "✅ Redis is ready"
    break
  fi
  echo "   Attempt $i/30..."
  sleep 2
done

# Run database setup
echo "🗄️  Setting up database..."
pnpm --filter @engage/database db:setup

# Build all packages
echo "🏗️  Building packages..."
pnpm install --frozen-lockfile
pnpm build

# Create systemd services
echo "📋 Creating systemd services..."

# API service
sudo tee /etc/systemd/system/engage-api.service > /dev/null << EOF
[Unit]
Description=ORKESTAI ENGAGE API
After=docker.service docker-compose-up.service
Requires=docker.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=$REPO_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/pnpm --filter @engage/api start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Worker service
sudo tee /etc/systemd/system/engage-worker.service > /dev/null << EOF
[Unit]
Description=ORKESTAI ENGAGE Worker
After=docker.service engage-api.service
Requires=docker.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=$REPO_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/pnpm --filter @engage/worker start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Web service
sudo tee /etc/systemd/system/engage-web.service > /dev/null << EOF
[Unit]
Description=ORKESTAI ENGAGE Web Dashboard
After=docker.service engage-api.service
Requires=docker.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=$REPO_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/pnpm --filter @engage/web start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload
echo "✅ Systemd services created"

# Start services
echo "🚀 Starting services..."
sudo systemctl start engage-api
sudo systemctl start engage-worker
sudo systemctl start engage-web

# Enable services to start on boot
sudo systemctl enable engage-api
sudo systemctl enable engage-worker
sudo systemctl enable engage-web

echo ""
echo "✨ Setup completed!"
echo ""
echo "📊 Services status:"
sudo systemctl status engage-api --no-pager
sudo systemctl status engage-worker --no-pager
sudo systemctl status engage-web --no-pager

echo ""
echo "🌐 Access:"
IP=$(hostname -I | awk '{print $1}')
echo "   API: http://$IP:3001"
echo "   Web: http://$IP:3000"
echo "   Bull Board: http://$IP:3002"
echo "   API Docs: http://$IP:3001/docs"

echo ""
echo "📝 View logs:"
echo "   API: sudo journalctl -u engage-api -f"
echo "   Worker: sudo journalctl -u engage-worker -f"
echo "   Web: sudo journalctl -u engage-web -f"
