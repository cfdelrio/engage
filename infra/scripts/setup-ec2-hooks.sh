#!/bin/bash
# Setup git hooks on EC2 to auto-rebuild after pulls
# Usage: bash infra/scripts/setup-ec2-hooks.sh

set -e

cd /home/ec2-user/engage || { echo "Not in engage directory"; exit 1; }

echo "🔧 Setting up git hooks for auto-rebuild..."

# 1. Configure git to use .githooks directory
git config core.hooksPath .githooks
echo "✓ Git configured to use .githooks"

# 2. Make hooks executable
chmod +x .githooks/*
echo "✓ Hooks made executable"

# 3. Verify hook exists
if [ -f .githooks/post-merge ]; then
  echo "✓ post-merge hook found"
else
  echo "✗ post-merge hook NOT found"
  exit 1
fi

echo ""
echo "🎉 Git hooks configured!"
echo ""
echo "Now when you git pull on EC2:"
echo "  1. If source files changed → automatic rebuild"
echo "  2. If only docs changed → skip rebuild"
echo ""
echo "To manually rebuild anytime:"
echo "  bash infra/scripts/restart-all.sh"
