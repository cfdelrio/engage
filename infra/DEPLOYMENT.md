# ORKESTAI ENGAGE — Deployment Guide (AWS EC2)

## Prerequisites

- **Instance**: AWS EC2 t3.micro (or larger)
- **AMI**: Amazon Linux 2023
- **Node.js**: v22 (via NVM)
- **Docker**: Latest (for postgres, redis, bullboard)
- **Git**: For cloning the repository
- **Domain**: orkestai.ar (with `engage` subdomain)
- **Static IP**: Elastic IP assigned to your instance

## Domain & SSL Setup (engage.orkestai.ar)

**Before running services**, configure your domain:

1. **Point DNS** to your EC2 instance IP in your domain registrar:
   ```
   A record: engage → your-elastic-ip (e.g., 44.223.7.160)
   ```

2. **Run SSL setup** (after DNS propagates, ~5-30 mins):
   ```bash
   cd /home/ec2-user/engage
   bash infra/scripts/setup-ssl.sh engage.orkestai.ar
   ```

   This script automatically:
   - Obtains Let's Encrypt certificate
   - Installs and configures NGINX reverse proxy
   - Sets up auto-renewal
   - Updates systemd services with HTTPS URLs

3. **Verify everything**:
   ```bash
   curl -I https://engage.orkestai.ar  # Should return 200
   sudo systemctl status nginx          # Check reverse proxy
   ```

**See `infra/DNS.md` for complete DNS & SSL troubleshooting.**

## Quick Setup (from scratch)

```bash
# 1. Update system and install dependencies
sudo yum update -y
sudo yum install -y git docker

# 2. Start Docker daemon
sudo systemctl start docker
sudo usermod -aG docker ec2-user
newgrp docker

# 3. Install Node.js via NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
npm install -g pnpm

# 4. Clone and setup repository
git clone https://github.com/cfdelrio/engage.git
cd engage

# 5. Install dependencies
pnpm install --frozen-lockfile

# 6. Setup database
docker compose up -d postgres redis bullboard postgres_shadow

# 7. Run migrations and seed
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed

# 8. Build all packages
pnpm build
```

## Running Services Manually

### Via nohup (temporary)

```bash
# Terminal 1: API
cd /home/ec2-user/engage
export NODE_ENV=production DATABASE_URL=postgresql://engage:engage@localhost:5432/engage REDIS_URL=redis://localhost:6379
nohup node apps/api/dist/index.js > ~/api.log 2>&1 &

# Terminal 2: Worker
export NODE_ENV=production DATABASE_URL=postgresql://engage:engage@localhost:5432/engage REDIS_URL=redis://localhost:6379
nohup node apps/worker/dist/index.js > ~/worker.log 2>&1 &

# Terminal 3: Web Dashboard
cd /home/ec2-user/engage/apps/web/.next/standalone
export NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 INTERNAL_API_URL=http://localhost:3001 NEXT_PUBLIC_API_URL=http://44.223.7.160:3001
nohup node apps/web/server.js > ~/web.log 2>&1 &
```

## Running Services via Systemd (persistent)

### 1. Copy systemd service files

```bash
cd /home/ec2-user/engage
sudo cp infra/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### 2. Update NEXT_PUBLIC_API_URL in orkestai-web.service

Replace `http://44.223.7.160:3001` with your actual public IP:

```bash
sudo nano /etc/systemd/system/orkestai-web.service
# Edit the NEXT_PUBLIC_API_URL line, save (Ctrl+X, Y, Enter)
sudo systemctl daemon-reload
```

### 3. Start services

```bash
sudo systemctl start orkestai-api orkestai-worker orkestai-web

# Check status
sudo systemctl status orkestai-api orkestai-worker orkestai-web

# Enable to start on boot
sudo systemctl enable orkestai-api orkestai-worker orkestai-web
```

### 4. View logs

```bash
# API logs
sudo journalctl -u orkestai-api -f

# Worker logs
sudo journalctl -u orkestai-worker -f

# Web logs
sudo journalctl -u orkestai-web -f
```

## Troubleshooting

### Port already in use (EADDRINUSE)

```bash
# Kill all node processes
sudo killall -9 node

# Or specific port
sudo lsof -i :3000
sudo kill -9 <PID>
```

### Database connection error

```bash
# Check postgres is running
docker compose ps postgres

# Verify credentials in .env
cat /home/ec2-user/engage/.env | grep DATABASE_URL

# Test connection
psql postgresql://engage:engage@localhost:5432/engage -c "SELECT 1"
```

### Redis connection error

```bash
# Check redis is running
docker compose ps redis

# Test connection
redis-cli ping  # Should return PONG
```

## Accessing the Platform

### After SSL Setup (Recommended)

| Service | URL |
|---------|-----|
| Dashboard | https://engage.orkestai.ar |
| API | https://api.engage.orkestai.ar |
| Swagger | https://api.engage.orkestai.ar/docs |
| Bull Board | http://engage.orkestai.ar:3002 |

**Direct IP access** (still works):
```
http://YOUR_ELASTIC_IP:3000  (Web, HTTP only)
http://YOUR_ELASTIC_IP:3001  (API, HTTP only)
http://YOUR_ELASTIC_IP:3002  (Bull Board)
```

## Backup and Maintenance

### Database backup

```bash
docker compose exec postgres pg_dump -U engage engage > backup.sql
```

### Restore from backup

```bash
docker compose exec -T postgres psql -U engage engage < backup.sql
```

## Security Considerations

- ✅ Update `.env` with strong credentials
- ✅ Configure Security Groups to allow only necessary ports
- ✅ Use SSH keys instead of passwords
- ✅ Keep Node.js and packages updated
- ✅ Monitor logs regularly for errors

## Environment Variables

Create `.env` at `/home/ec2-user/engage/.env`:

```env
# Database
DATABASE_URL=postgresql://engage:engage@localhost:5432/engage
SHADOW_DATABASE_URL=postgresql://engage:engage@localhost:5433/engage_shadow

# Redis
REDIS_URL=redis://localhost:6379

# API
INTERNAL_API_URL=http://localhost:3001

# Web (set your public IP)
NEXT_PUBLIC_API_URL=http://YOUR_PUBLIC_IP:3001

# AI (optional)
ANTHROPIC_API_KEY=sk-ant-...

# Environment
NODE_ENV=production
```
