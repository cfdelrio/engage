#!/usr/bin/env bash
# ORKESTAI ENGAGE — Bootstrap para Amazon Linux 2023 (t3.micro)
# Uso: bash setup.sh
set -euo pipefail

REPO_URL="https://github.com/cfdelrio/engage.git"
BRANCH="claude/event-driven-engagement-platform-Bl7PI"
APP_DIR="/home/ec2-user/engage"
NODE_VERSION="22"

log() { echo -e "\n\033[1;36m[setup]\033[0m $*"; }
err() { echo -e "\033[1;31m[error]\033[0m $*" >&2; exit 1; }

# ── 1. Sistema ────────────────────────────────────────────────────────────────
log "Actualizando paquetes del sistema..."
sudo dnf update -y -q
sudo dnf install -y git curl tar gzip

# ── 2. Node.js 22 via nvm ─────────────────────────────────────────────────────
log "Instalando Node.js ${NODE_VERSION} via nvm..."
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
source "$NVM_DIR/nvm.sh"
nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"
nvm alias default "$NODE_VERSION"
echo 'export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"' >> ~/.bashrc

# ── 3. pnpm ───────────────────────────────────────────────────────────────────
log "Instalando pnpm..."
corepack enable
corepack prepare pnpm@10.11.0 --activate

# ── 4. Docker + Docker Compose ────────────────────────────────────────────────
log "Instalando Docker..."
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
# Compose plugin
COMPOSE_VERSION="v2.35.0"
COMPOSE_PATH="/usr/local/lib/docker/cli-plugins"
sudo mkdir -p "$COMPOSE_PATH"
sudo curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o "$COMPOSE_PATH/docker-compose"
sudo chmod +x "$COMPOSE_PATH/docker-compose"
log "Docker version: $(sudo docker --version)"
log "Compose version: $(sudo docker compose version)"

# ── 5. Clonar repo ────────────────────────────────────────────────────────────
log "Clonando repositorio..."
if [ -d "$APP_DIR" ]; then
  log "Directorio ya existe — haciendo pull..."
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 6. Variables de entorno ───────────────────────────────────────────────────
log "Creando .env desde .env.example..."
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
  # Rellenar valores mínimos para que arranque
  sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://engage:engage@localhost:5432/engage|" .env
  sed -i "s|SHADOW_DATABASE_URL=.*|SHADOW_DATABASE_URL=postgresql://engage:engage@localhost:5433/engage_shadow|" .env
  sed -i "s|REDIS_URL=.*|REDIS_URL=redis://localhost:6379|" .env
  sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://${PUBLIC_IP}:3001|" .env
  sed -i "s|NEXT_PUBLIC_WS_URL=.*|NEXT_PUBLIC_WS_URL=ws://${PUBLIC_IP}:3001|" .env
  sed -i "s|INTERNAL_API_KEY=.*|INTERNAL_API_KEY=internal-secret-change-me|" .env
  sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(openssl rand -hex 32)|" .env
  echo ""
  echo "⚠️  IMPORTANTE: editá /home/ec2-user/engage/.env antes de iniciar en producción."
  echo "   Especialmente: ANTHROPIC_API_KEY, RESEND_API_KEY, TWILIO_*, etc."
fi

# ── 7. Infraestructura local (Postgres + Redis) ───────────────────────────────
log "Levantando Postgres y Redis con Docker Compose..."
cd "$APP_DIR"
sudo docker compose up -d postgres redis

# Esperar a que Postgres esté listo
log "Esperando a que Postgres esté listo..."
for i in $(seq 1 30); do
  if sudo docker compose exec -T postgres pg_isready -U engage -d engage > /dev/null 2>&1; then
    log "Postgres listo."
    break
  fi
  sleep 2
  if [ "$i" -eq 30 ]; then
    err "Postgres no arrancó después de 60s. Revisá: sudo docker compose logs postgres"
  fi
done

# ── 8. Dependencias Node ──────────────────────────────────────────────────────
log "Instalando dependencias con pnpm..."
cd "$APP_DIR"
pnpm install --frozen-lockfile

# ── 9. Prisma generate + migrate + seed ──────────────────────────────────────
log "Generando Prisma Client..."
pnpm --filter @engage/database exec prisma generate

log "Corriendo migraciones..."
pnpm --filter @engage/database exec prisma migrate deploy

log "Seeding ProdeCaballito..."
pnpm --filter @engage/database db:seed 2>&1 | tee /tmp/seed-output.txt
# Guardar API key del seed
grep -i "api key\|oek_" /tmp/seed-output.txt > /home/ec2-user/prodecaballito-api-key.txt 2>/dev/null || true

# ── 10. Build ─────────────────────────────────────────────────────────────────
log "Haciendo build de todos los packages..."
pnpm build

# ── 11. Systemd services ──────────────────────────────────────────────────────
log "Creando servicios systemd..."

# Sourced NVM path para systemd
NODE_BIN=$(which node)
PNPM_BIN=$(which pnpm)

sudo tee /etc/systemd/system/engage-api.service > /dev/null <<EOF
[Unit]
Description=ORKESTAI ENGAGE API
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=${NODE_BIN} apps/api/dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/engage-worker.service > /dev/null <<EOF
[Unit]
Description=ORKESTAI ENGAGE Worker
After=engage-api.service
Requires=docker.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=${NODE_BIN} apps/worker/dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/engage-web.service > /dev/null <<EOF
[Unit]
Description=ORKESTAI ENGAGE Web
After=engage-api.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=${APP_DIR}/apps/web
EnvironmentFile=${APP_DIR}/.env
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
ExecStart=${NODE_BIN} .next/standalone/apps/web/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable engage-api engage-worker engage-web
sudo systemctl start engage-api engage-worker engage-web

# ── 12. Estado final ──────────────────────────────────────────────────────────
sleep 3
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ORKESTAI ENGAGE — Setup completado"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  Dashboard:    http://${PUBLIC_IP}:3000"
echo "  API:          http://${PUBLIC_IP}:3001"
echo "  API Docs:     http://${PUBLIC_IP}:3001/docs"
echo "  Bull Board:   http://${PUBLIC_IP}:3002  (queues)"
echo ""
echo "  API Key de ProdeCaballito:"
cat /home/ec2-user/prodecaballito-api-key.txt 2>/dev/null || echo "  (mirá el output del seed arriba)"
echo ""
echo "  Logs:"
echo "    sudo journalctl -u engage-api -f"
echo "    sudo journalctl -u engage-worker -f"
echo "    sudo journalctl -u engage-web -f"
echo ""
echo "  Estado de servicios:"
sudo systemctl is-active engage-api engage-worker engage-web | paste - - - | \
  awk '{print "    api=" $1 "  worker=" $2 "  web=" $3}'
echo ""
echo "  ⚠️  Acordate de abrir los puertos 3000, 3001, 3002 en el"
echo "      Security Group de la instancia."
echo "════════════════════════════════════════════════════════════"
