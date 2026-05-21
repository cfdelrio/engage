#!/bin/bash
# Setup SSL certificate for ORKESTAI ENGAGE using Let's Encrypt

set -e

DOMAIN="${1:-engage.orkestai.ar}"

if [ -z "$DOMAIN" ]; then
  echo "❌ Domain required. Usage: setup-ssl.sh <domain>"
  echo "   Example: setup-ssl.sh engage.orkestai.ar"
  exit 1
fi

echo "🔐 Setting up SSL certificate for $DOMAIN..."

# Install certbot
echo "📦 Installing certbot..."
sudo yum install -y certbot python3-certbot-nginx

# Get certificate (with email prompt)
echo ""
echo "📧 Obtaining SSL certificate for $DOMAIN and api.$DOMAIN..."
echo ""
sudo certbot certonly --standalone -d "$DOMAIN" -d "api.$DOMAIN" --non-interactive --agree-tos --email cfdelrio@gmail.com --expand

CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem"

if ! sudo test -f "$CERT_PATH"; then
  echo "❌ Certificate not found at $CERT_PATH"
  exit 1
fi

echo "✅ Certificate obtained for $DOMAIN"
echo "   Cert: $CERT_PATH"
echo "   Key:  $KEY_PATH"

# Update systemd service for Web (HTTPS on 443, but keep 3000 for localhost)
echo ""
echo "🌐 Updating orkestai-web.service with SSL config..."
sudo tee /etc/systemd/system/orkestai-web.service > /dev/null <<EOF
[Unit]
Description=ORKESTAI ENGAGE Web Dashboard
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/engage/apps/web/.next/standalone
ExecStart=/home/ec2-user/.nvm/versions/node/v22.22.3/bin/node apps/web/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"
Environment="HOSTNAME=0.0.0.0"
Environment="PORT=3000"
Environment="INTERNAL_API_URL=http://localhost:3001"
Environment="NEXT_PUBLIC_API_URL=https://api.$DOMAIN"

[Install]
WantedBy=multi-user.target
EOF

# Update API service (keep on 3001, secure with reverse proxy separate from here)
echo "📝 Updating orkestai-api.service..."
sudo tee /etc/systemd/system/orkestai-api.service > /dev/null <<EOF
[Unit]
Description=ORKESTAI ENGAGE API Service
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/engage
ExecStart=/home/ec2-user/.nvm/versions/node/v22.22.3/bin/node apps/api/dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"
Environment="DATABASE_URL=postgresql://engage:engage@localhost:5432/engage"
Environment="REDIS_URL=redis://localhost:6379"

[Install]
WantedBy=multi-user.target
EOF

# Update worker service
echo "📝 Updating orkestai-worker.service..."
sudo tee /etc/systemd/system/orkestai-worker.service > /dev/null <<EOF
[Unit]
Description=ORKESTAI ENGAGE Worker Service
After=network.target orkestai-api.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/engage
ExecStart=/home/ec2-user/.nvm/versions/node/v22.22.3/bin/node apps/worker/dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"
Environment="DATABASE_URL=postgresql://engage:engage@localhost:5432/engage"
Environment="REDIS_URL=redis://localhost:6379"

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
echo "🔄 Reloading systemd daemon..."
sudo systemctl daemon-reload

# Create NGINX reverse proxy for HTTPS
echo ""
echo "🌐 Setting up NGINX reverse proxy..."
sudo yum install -y nginx

# Backup original nginx config
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak

# Create ORKESTAI ENGAGE config
sudo tee /etc/nginx/conf.d/orkestai.conf > /dev/null <<EOF
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS Web Dashboard
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate $CERT_PATH;
    ssl_certificate_key $KEY_PATH;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

# HTTPS API (port 3001)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.$DOMAIN;

    ssl_certificate $CERT_PATH;
    ssl_certificate_key $KEY_PATH;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

# Note: Bull Board runs directly on port 3002 (not proxied through NGINX)
# Access at http://$DOMAIN:3002
EOF

# Test nginx config
echo "🔍 Testing NGINX configuration..."
sudo nginx -t

# Start and enable nginx
echo "🚀 Starting NGINX..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Setup certbot auto-renewal with nginx
echo ""
echo "🔄 Setting up automatic certificate renewal..."
sudo certbot install --nginx -d "$DOMAIN" --non-interactive --agree-tos -q || echo "⚠️  Auto-renewal setup skipped (manual renewal available)"

echo ""
echo "✨ SSL setup complete!"
echo ""
echo "📍 Your ORKESTAI ENGAGE URLs:"
echo "  Dashboard:  https://$DOMAIN"
echo "  API:        https://api.$DOMAIN"
echo "  Swagger:    https://api.$DOMAIN/docs"
echo "  Bull Board: http://$DOMAIN:3002"
echo ""
echo "📝 Next steps:"
echo "  1. Verify DNS: nslookup $DOMAIN"
echo "  2. Test HTTPS: curl -I https://$DOMAIN"
echo "  3. View dashboard: https://$DOMAIN"
echo "  4. Check certificate: sudo certbot certificates"
echo "  5. View logs: sudo journalctl -u orkestai-web -f"
echo ""
echo "🔄 Services will restart automatically. Check status:"
echo "  sudo systemctl status orkestai-api orkestai-worker orkestai-web nginx"
echo ""
echo "📋 Certificate renewal:"
echo "  Automatic via certbot (checks daily, renews if within 30 days)"
echo "  Logs: /var/log/letsencrypt/renewal.log"
