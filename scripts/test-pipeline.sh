#!/bin/bash

# Test script for event pipeline
# Usage: bash scripts/test-pipeline.sh <API_KEY> [API_URL]

set -e

API_KEY="${1:-oek_nGOofbQkTl1Y3hel9xz51uoEkEQHKJF6lvg0rNuGQuI}"
API_URL="${2:-http://localhost:3001}"

echo "🧪 Testing ORKESTAI ENGAGE Pipeline"
echo "===================================="
echo ""
echo "API URL: $API_URL"
echo "API Key: ${API_KEY:0:10}..."
echo ""

# Test 1: Health check
echo "1️⃣  Health Check..."
HEALTH=$(curl -s "$API_URL/health")
if echo "$HEALTH" | grep -q "ok"; then
  echo "   ✅ API is healthy"
else
  echo "   ❌ API health check failed"
  echo "   Response: $HEALTH"
  exit 1
fi

# Test 2: Create event (ranking changed)
echo ""
echo "2️⃣  Creating event: ranking changed..."
EVENT_RESPONSE=$(curl -s -X POST "$API_URL/v1/events" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "type": "prode.ranking.changed",
    "userId": "test-user-1",
    "payload": {
      "newRank": 1,
      "previousRank": 5,
      "teamName": "Mi Equipo"
    },
    "metadata": {
      "source": "test-script"
    }
  }')

EVENT_ID=$(echo "$EVENT_RESPONSE" | grep -o '"eventId":"[^"]*"' | cut -d'"' -f4)
if [ -z "$EVENT_ID" ]; then
  echo "   ❌ Failed to create event"
  echo "   Response: $EVENT_RESPONSE"
  exit 1
fi
echo "   ✅ Event created: $EVENT_ID"

# Test 3: Get event details
echo ""
echo "3️⃣  Fetching event details..."
EVENT_DETAILS=$(curl -s "$API_URL/v1/events/$EVENT_ID" \
  -H "x-api-key: $API_KEY")

if echo "$EVENT_DETAILS" | grep -q "$EVENT_ID"; then
  echo "   ✅ Event retrieved successfully"
else
  echo "   ❌ Failed to retrieve event"
  echo "   Response: $EVENT_DETAILS"
  exit 1
fi

# Test 4: Check processing logs
echo ""
echo "4️⃣  Checking event processing..."
PROCESSING_LOG=$(echo "$EVENT_DETAILS" | grep -o '"processingLogs":\[[^]]*\]' || echo "")
if [ -n "$PROCESSING_LOG" ]; then
  echo "   ✅ Processing logs found"
  echo "   Logs: $PROCESSING_LOG"
else
  echo "   ⚠️  No processing logs yet (worker may still be processing)"
  sleep 2
  EVENT_DETAILS=$(curl -s "$API_URL/v1/events/$EVENT_ID" \
    -H "x-api-key: $API_KEY")
  PROCESSING_LOG=$(echo "$EVENT_DETAILS" | grep -o '"processingLogs":\[[^]]*\]' || echo "")
  if [ -n "$PROCESSING_LOG" ]; then
    echo "   ✅ Processing logs found after retry"
  fi
fi

# Test 5: Create high-fatigue event (should suppress)
echo ""
echo "5️⃣  Creating event with user preference..."
EVENT_RESPONSE2=$(curl -s -X POST "$API_URL/v1/events" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "type": "prode.goal.scored",
    "userId": "test-user-1",
    "payload": {
      "team": "Argentina",
      "minute": 45
    },
    "idempotencyKey": "test-goal-'$(date +%s%N)'"
  }')

EVENT_ID2=$(echo "$EVENT_RESPONSE2" | grep -o '"eventId":"[^"]*"' | cut -d'"' -f4)
if [ -n "$EVENT_ID2" ]; then
  echo "   ✅ Second event created: $EVENT_ID2"
else
  echo "   ❌ Failed to create second event"
  echo "   Response: $EVENT_RESPONSE2"
fi

# Summary
echo ""
echo "✨ Pipeline test completed!"
echo ""
echo "📊 Test Summary:"
echo "   Event 1 (ranking): $EVENT_ID"
echo "   Event 2 (goal): ${EVENT_ID2:-Not created}"
echo ""
echo "📋 Next steps:"
echo "   1. View logs: tail -f .logs/api.log .logs/worker.log"
echo "   2. Check Bull Board: http://$API_URL:3002"
echo "   3. View database: psql -U engage -d engage"
echo "   4. Dashboard: http://${API_URL%:*}:3000/dashboard"
