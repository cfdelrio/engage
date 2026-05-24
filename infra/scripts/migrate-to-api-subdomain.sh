#!/bin/bash
# Migrate from path-based routing (engage.orkestai.ar/v1) to subdomain-based (api.engage.orkestai.ar)
# Usage: bash migrate-to-api-subdomain.sh [domain]
# Example: bash migrate-to-api-subdomain.sh engage.orkestai.ar

set -e

DOMAIN="${1:-engage.orkestai.ar}"
API_DOMAIN="api.${DOMAIN}"

echo "🔄 Migrating to subdomain-based routing..."
echo "   Main domain:  $DOMAIN"
echo "   API domain:   $API_DOMAIN"
echo ""

# Check if running on EC2
if [ ! -f /home/ec2-user/.env ]; then
  echo "❌ Not running on EC2 (no /home/ec2-user/.env found)"
  exit 1
fi

echo "📝 Updating .env file..."
sed -i "s|NEXT_PUBLIC_API_URL=\"https://$DOMAIN\"|NEXT_PUBLIC_API_URL=\"https://$API_DOMAIN\"|g" /home/ec2-user/engage/.env
sed -i "s|NEXT_PUBLIC_WS_URL=\"wss://$DOMAIN\"|NEXT_PUBLIC_WS_URL=\"wss://$API_DOMAIN\"|g" /home/ec2-user/engage/.env

echo "🔐 Checking SSL certificate..."
# If DNS hasn't propagated yet, skip cert update (existing cert will work via CNAME)
if dig +short "$API_DOMAIN" | grep -q .; then
  echo "📧 Obtaining new certificate with both domains..."
  sudo certbot certonly --standalone -d "$DOMAIN" -d "$API_DOMAIN" \
    --non-interactive --agree-tos --email cfdelrio@gmail.com \
    --expand --force-renewal 2>/dev/null || echo "⚠️  Cert renewal skipped (will retry after DNS propagates)"
else
  echo "⚠️  DNS for $API_DOMAIN not yet propagated. Using existing certificate."
  echo "    Run this after DNS propagates to update the certificate:"
  echo "    sudo certbot renew --force-renewal"
fi

CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem"

echo "🌐 Updating NGINX configuration..."

# Backup current config
sudo cp /etc/nginx/conf.d/orkestai.conf /etc/nginx/conf.d/orkestai.conf.backup || echo "⚠️  No existing nginx config to backup"

# Create new vhost-based config
sudo tee /etc/nginx/conf.d/orkestai.conf > /dev/null <<EOF
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN $API_DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS — API subdomain (api.$DOMAIN)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $API_DOMAIN;

    ssl_certificate $CERT_PATH;
    ssl_certificate_key $KEY_PATH;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # All routes → Fastify API (port 3001)
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}

# HTTPS — Web dashboard ($DOMAIN)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate $CERT_PATH;
    ssl_certificate_key $KEY_PATH;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # All routes → Next.js (port 3000)
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
EOF

echo "🔍 Testing NGINX configuration..."
sudo nginx -t

echo "🚀 Reloading NGINX..."
sudo systemctl reload nginx

echo "📝 Updating systemd service for web..."
sudo systemctl set-environment "NEXT_PUBLIC_API_URL=https://$API_DOMAIN"
sudo systemctl set-environment "NEXT_PUBLIC_WS_URL=wss://$API_DOMAIN"

echo "🔄 Restarting services..."
sudo systemctl restart orkestai-web

echo ""
echo "✨ Migration complete!"
echo ""
echo "📍 Updated URLs:"
echo "  Dashboard:  https://$DOMAIN"
echo "  API:        https://$API_DOMAIN/v1"
echo "  Swagger:    https://$API_DOMAIN/docs"
echo ""
echo "📋 Verify migration:"
echo "  1. Dashboard:  curl -I https://$DOMAIN"
echo "  2. API:        curl -I https://$API_DOMAIN/docs"
echo "  3. Logs:       sudo journalctl -u orkestai-web -f"
echo ""
echo "⚠️  Important: Update any external clients calling the API:"
echo "   OLD: curl https://$DOMAIN/v1/events"
echo "   NEW: curl https://$API_DOMAIN/v1/events"
echo ""
