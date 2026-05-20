#!/bin/bash
# Setup systemd services for ORKESTAI ENGAGE on EC2

set -e

echo "📦 Setting up systemd services for ORKESTAI ENGAGE..."

# Detect Node.js path
NODE_PATH=$(which node)
echo "✓ Node.js found at: $NODE_PATH"

# Copy service files
echo "📋 Copying systemd service files..."
sudo cp "$(dirname "$0")/../systemd/orkestai-api.service" /etc/systemd/system/
sudo cp "$(dirname "$0")/../systemd/orkestai-worker.service" /etc/systemd/system/
sudo cp "$(dirname "$0")/../systemd/orkestai-web.service" /etc/systemd/system/

# Reload systemd
echo "🔄 Reloading systemd daemon..."
sudo systemctl daemon-reload

# Prompt for public IP (for web service)
echo ""
echo "📍 What is your instance's public IP? (for NEXT_PUBLIC_API_URL)"
read -p "Enter IP (e.g., 44.223.7.160): " PUBLIC_IP

if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP="localhost"
fi

# Update web service with public IP
echo "🌐 Updating orkestai-web.service with IP: $PUBLIC_IP"
sudo sed -i "s|http://localhost:3001|http://$PUBLIC_IP:3001|g" /etc/systemd/system/orkestai-web.service
sudo systemctl daemon-reload

# Start services
echo ""
echo "🚀 Starting services..."
sudo systemctl start orkestai-api orkestai-worker orkestai-web

sleep 3

# Check status
echo ""
echo "📊 Service status:"
sudo systemctl status orkestai-api orkestai-worker orkestai-web --no-pager

# Enable on boot
echo ""
echo "✅ Enabling services on boot..."
sudo systemctl enable orkestai-api orkestai-worker orkestai-web

echo ""
echo "✨ Setup complete!"
echo ""
echo "📍 Platform URLs:"
echo "  Dashboard:  http://$PUBLIC_IP:3000"
echo "  API:        http://$PUBLIC_IP:3001"
echo "  Swagger:    http://$PUBLIC_IP:3001/docs"
echo "  Bull Board: http://$PUBLIC_IP:3002"
echo ""
echo "📝 View logs:"
echo "  API:    sudo journalctl -u orkestai-api -f"
echo "  Worker: sudo journalctl -u orkestai-worker -f"
echo "  Web:    sudo journalctl -u orkestai-web -f"
