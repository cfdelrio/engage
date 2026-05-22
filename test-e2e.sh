#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}ORKESTAI ENGAGE — End-to-End Pipeline Test${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# 1. Check prerequisites
echo -e "${BLUE}[1/7] Checking Prerequisites...${NC}"

if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

if ! command -v psql &> /dev/null; then
  echo -e "${RED}✗ PostgreSQL client not found${NC}"
  exit 1
fi
echo -e "${GREEN}✓ PostgreSQL client${NC}"

if ! command -v redis-cli &> /dev/null; then
  echo -e "${RED}✗ Redis CLI not found${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Redis CLI${NC}"

# 2. Verify database connection
echo -e "\n${BLUE}[2/7] Verifying Database Connection...${NC}"

if ! psql -h localhost -U engage -d engage -c "SELECT 1" > /dev/null 2>&1; then
  echo -e "${RED}✗ Cannot connect to PostgreSQL at localhost:5432${NC}"
  echo -e "${YELLOW}  Make sure: psql -h localhost -U engage -d engage works${NC}"
  exit 1
fi
echo -e "${GREEN}✓ PostgreSQL connected (localhost:5432)${NC}"

if ! redis-cli ping > /dev/null 2>&1; then
  echo -e "${RED}✗ Cannot connect to Redis at localhost:6379${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Redis connected (localhost:6379)${NC}"

# 3. Check API is running
echo -e "\n${BLUE}[3/7] Checking if API is running...${NC}"

if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo -e "${RED}✗ API not responding on port 3001${NC}"
  echo -e "${YELLOW}  Start with: NODE_ENV=production node apps/api/dist/index.js &${NC}"
  exit 1
fi
echo -e "${GREEN}✓ API listening on port 3001${NC}"

# 4. Get API key from database
echo -e "\n${BLUE}[4/7] Getting ProdeCaballito API Key...${NC}"

API_KEY=$(psql -h localhost -U engage -d engage -t -c \
  "SELECT \"keyHash\" FROM \"TenantApiKey\" k \
   JOIN \"Tenant\" t ON k.\"tenantId\" = t.id \
   WHERE t.slug = 'prodecaballito' LIMIT 1" 2>/dev/null || echo "")

if [ -z "$API_KEY" ]; then
  echo -e "${RED}✗ Could not find ProdeCaballito API key${NC}"
  echo -e "${YELLOW}  Run: pnpm db:seed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Found API key: ${API_KEY:0:20}...${NC}"

# 5. Send test event
echo -e "\n${BLUE}[5/7] Sending Test Event...${NC}"

EVENT_RESPONSE=$(curl -s -X POST http://localhost:3001/v1/events \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "type": "prode.result_published.individual",
    "userId": "test_victory_final",
    "idempotencyKey": "test_result_'$(date +%s%N)'",
    "payload": {
      "business_context": {
        "match": { "id": 1, "local": "Argentina", "away": "Brasil", "goles_local": 2, "goles_visitante": 1 },
        "bet": { "goles_local": 2, "goles_visitante": 1, "puntos_obtenidos": 3 },
        "outcome": "exacto"
      }
    },
    "metadata": {
      "channels_hint": ["email"],
      "user_contact": {
        "nombre": "Test User",
        "email": "test@example.com",
        "phone": "+5491123456789",
        "whatsapp_consent": true
      }
    }
  }')

EVENT_ID=$(echo "$EVENT_RESPONSE" | grep -o '"eventId":"[^"]*' | cut -d'"' -f4)

if [ -z "$EVENT_ID" ]; then
  echo -e "${RED}✗ Failed to send event${NC}"
  echo -e "${YELLOW}  Response: $EVENT_RESPONSE${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Event sent: $EVENT_ID${NC}"

# 6. Wait for processing
echo -e "\n${BLUE}[6/7] Waiting for Event Processing (15s)...${NC}"

sleep 15

# 7. Verify deliveries
echo -e "\n${BLUE}[7/7] Verifying Delivery Pipeline...${NC}"

# Check Event
EVENT_COUNT=$(psql -h localhost -U engage -d engage -t -c \
  "SELECT COUNT(*) FROM \"Event\" WHERE id = '$EVENT_ID'" 2>/dev/null)

if [ "$EVENT_COUNT" = "1" ]; then
  echo -e "${GREEN}✓ Event recorded in database${NC}"
else
  echo -e "${YELLOW}⚠ Event not found in database${NC}"
fi

# Check EngagementDecision
DECISION_COUNT=$(psql -h localhost -U engage -d engage -t -c \
  "SELECT COUNT(*) FROM \"EngagementDecision\" \
   WHERE \"eventId\" = '$EVENT_ID'" 2>/dev/null)

echo -e "${GREEN}✓ Engagement Decisions created: $DECISION_COUNT${NC}"

# Check Delivery
DELIVERY_INFO=$(psql -h localhost -U engage -d engage -t -c \
  "SELECT channel, provider, status FROM \"Delivery\" \
   WHERE \"userId\" = 'test_victory_final' \
   ORDER BY \"createdAt\" DESC LIMIT 1" 2>/dev/null)

if [ -z "$DELIVERY_INFO" ]; then
  echo -e "${YELLOW}⚠ No delivery record found${NC}"
else
  echo -e "${GREEN}✓ Delivery record:${NC}"
  echo "$DELIVERY_INFO" | while read channel provider status; do
    echo -e "  - Channel: ${BLUE}$channel${NC}, Provider: ${BLUE}$provider${NC}, Status: ${BLUE}$status${NC}"
  done
fi

# Summary
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ End-to-End Test Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "\nNext steps:"
echo -e "1. Check worker logs: tail -f /tmp/worker.log"
echo -e "2. Check API logs: tail -f /tmp/api.log"
echo -e "3. Monitor Bull Board: http://localhost:3002"
echo -e "4. Query deliveries: SELECT * FROM \"Delivery\" WHERE \"userId\" = 'test_victory_final';"
echo -e "\nFor full troubleshooting, see: RUNBOOK.md"
