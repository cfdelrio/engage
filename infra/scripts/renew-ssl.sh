#!/bin/bash
# Renew SSL certificates for Engage
# Usage: ./renew-ssl.sh [ec2-host] [ec2-user] [ssh-key]
# Example: ./renew-ssl.sh 44.199.212.116 ec2-user ~/.ssh/id_rsa

set -e

EC2_HOST="${1:-$EC2_HOST}"
EC2_USER="${2:-ec2-user}"
SSH_KEY="${3:-$EC2_SSH_KEY}"

if [[ -z "$EC2_HOST" ]]; then
    echo "❌ Error: EC2_HOST not provided"
    echo "Usage: $0 <ec2-host> [ec2-user] [ssh-key]"
    exit 1
fi

echo "🔄 Connecting to EC2 instance: $EC2_HOST"
echo "📍 User: $EC2_USER"

ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" bash -s << 'EOF'
set -e

echo "🔄 Starting certificate renewal process..."
echo "📋 Current time: $(date)"

echo ""
echo "📋 Checking current certificates:"
sudo certbot certificates

echo ""
echo "🔄 Running certbot renew..."
sudo certbot renew --non-interactive --quiet

echo ""
echo "✅ Certificates renewed successfully"
echo "📋 Updated certificates:"
sudo certbot certificates

echo ""
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

echo "✅ Nginx reloaded"
echo ""
echo "🎉 SSL renewal completed at $(date)"
EOF

echo ""
echo "✅ Certificate renewal completed successfully!"
