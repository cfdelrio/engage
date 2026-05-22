#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}ORKESTAI ENGAGE — Full Pipeline Test with Real Credentials${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# Load environment variables
set -a
source .env
set +a

if [ -z "$RESEND_API_KEY" ] || [ -z "$TWILIO_ACCOUNT_SID" ]; then
  echo -e "${RED}✗ Missing credentials in .env${NC}"
  echo -e "${YELLOW}  Set RESEND_API_KEY and TWILIO_* variables${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Credentials loaded from .env${NC}"
echo -e "  - RESEND_API_KEY: ${RESEND_API_KEY:0:10}...${NC}"
echo -e "  - TWILIO_ACCOUNT_SID: ${TWILIO_ACCOUNT_SID}${NC}\n"

# 1. Get API key from database
echo -e "${BLUE}[1/6] Getting ProdeCaballito API Key...${NC}"

API_KEY=$(psql -h localhost -U engage -d engage -t -c \
  "SELECT \"keyHash\" FROM \"TenantApiKey\" k \
   JOIN \"Tenant\" t ON k.\"tenantId\" = t.id \
   WHERE t.slug = 'prodecaballito' LIMIT 1" 2>/dev/null || echo "")

if [ -z "$API_KEY" ]; then
  echo -e "${RED}✗ Could not find ProdeCaballito API key${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Found API key: ${API_KEY:0:20}...${NC}"

# 2. Get tenant info
echo -e "\n${BLUE}[2/6] Verifying Tenant and Event Definitions...${NC}"

TENANT_ID=$(psql -h localhost -U engage -d engage -t -c \
  "SELECT id FROM \"Tenant\" WHERE slug = 'prodecaballito'" 2>/dev/null)

EVENT_DEF_COUNT=$(psql -h localhost -U engage -d engage -t -c \
  "SELECT COUNT(*) FROM \"EventDefinition\" WHERE \"tenantId\" = '$TENANT_ID'" 2>/dev/null)

TEMPLATE_COUNT=$(psql -h localhost -U engage -d engage -t -c \
  "SELECT COUNT(*) FROM \"Template\" WHERE \"tenantId\" = '$TENANT_ID'" 2>/dev/null)

RULES_COUNT=$(psql -h localhost -U engage -d engage -t -c \
  "SELECT COUNT(*) FROM \"Rule\" WHERE \"tenantId\" = '$TENANT_ID'" 2>/dev/null)

echo -e "${GREEN}✓ Tenant: prodecaballito (${TENANT_ID:0:10}...)${NC}"
echo -e "${GREEN}✓ Event Definitions: $EVENT_DEF_COUNT${NC}"
echo -e "${GREEN}✓ Templates: $TEMPLATE_COUNT${NC}"
echo -e "${GREEN}✓ Rules: $RULES_COUNT${NC}"

# 3. Send test event - Individual result with email + WhatsApp
echo -e "\n${BLUE}[3/6] Sending Test Event (prode.result_published.individual)...${NC}"

TEST_USER_ID="test_user_$(date +%s)"
IDEMPOTENCY_KEY="test_pipeline_$(date +%s%N)"

EVENT_RESPONSE=$(curl -s -X POST http://localhost:3001/v1/events \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "type": "prode.result_published.individual",
    "userId": "'$TEST_USER_ID'",
    "idempotencyKey": "'$IDEMPOTENCY_KEY'",
    "payload": {
      "business_context": {
        "match": {
          "id": 1337,
          "local": "Argentina",
          "away": "Brasil",
          "goles_local": 2,
          "goles_visitante": 1
        },
        "bet": {
          "goles_local": 2,
          "goles_visitante": 1,
          "puntos_obtenidos": 3
        },
        "ranking_after": {
          "position": 7,
          "delta": 3
        },
        "outcome": "exacto"
      }
    },
    "metadata": {
      "channels_hint": ["email", "whatsapp"],
      "user_contact": {
        "nombre": "Test User",
        "email": "test@example.com",
        "phone": "+5491123456789",
        "whatsapp_consent": true,
        "idioma_pref": "es"
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
echo -e "  User: $TEST_USER_ID"
echo -e "  Idempotency: $IDEMPOTENCY_KEY"

# 4. Wait for processing
echo -e "\n${BLUE}[4/6] Waiting for Processing (12s)...${NC}"

for i in {1..12}; do
  echo -ne "\r  ⏱ ${i}s..."
  sleep 1
done
echo -e "\n  ${GREEN}✓ Processing window complete${NC}"

# 5. Verify pipeline state in database
echo -e "\n${BLUE}[5/6] Verifying Pipeline State...${NC}"

# Check Event
echo -ne "  Checking Event... "
EVENT_COUNT=$(psql -h localhost -U engage -d engage -t -c \
  "SELECT COUNT(*) FROM \"Event\" WHERE id = '$EVENT_ID'" 2>/dev/null)
if [ "$EVENT_COUNT" = "1" ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ Not found${NC}"
fi

# Check RuleExecution
echo -ne "  Checking RuleExecution... "
RULE_EXEC_COUNT=$(psql -h localhost -U engage -d engage -t -c \
  "SELECT COUNT(*) FROM \"RuleExecution\" WHERE \"eventId\" = '$EVENT_ID' AND matched = true" 2>/dev/null)
echo -e "${GREEN}✓ ${RULE_EXEC_COUNT} matched${NC}"

# Check EngagementDecision
echo -ne "  Checking EngagementDecision... "
DECISION_COUNT=$(psql -h localhost -U engage -d engage -t -c \
  "SELECT COUNT(*) FROM \"EngagementDecision\" WHERE \"eventId\" = '$EVENT_ID'" 2>/dev/null)
echo -e "${GREEN}✓ ${DECISION_COUNT} decisions${NC}"

# Check Delivery
echo -ne "  Checking Delivery... "
DELIVERY_INFO=$(psql -h localhost -U engage -d engage -t -c \
  "SELECT channel, provider, status, COUNT(*) as cnt FROM \"Delivery\" \
   WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE \"externalId\" = '$TEST_USER_ID') \
   GROUP BY channel, provider, status" 2>/dev/null)

if [ -z "$DELIVERY_INFO" ]; then
  echo -e "${YELLOW}⚠ No deliveries found yet${NC}"
else
  echo -e "${GREEN}✓${NC}"
  echo "$DELIVERY_INFO" | while read channel provider status cnt; do
    echo -e "    - ${CYAN}$channel${NC} ($provider): ${YELLOW}${status}${NC} (×$cnt)"
  done
fi

# 6. Check provider queues
echo -e "\n${BLUE}[6/6] Checking BullMQ Queue Status...${NC}"

echo -ne "  Checking Redis queues... "
QUEUE_SIZES=$(redis-cli <<EOF
KEYS "bull:*:waiting"
EOF
)

if [ -z "$QUEUE_SIZES" ]; then
  echo -e "${GREEN}✓ All queues idle${NC}"
else
  echo -e "${YELLOW}⚠ Jobs still in queues${NC}"
  redis-cli <<EOF
DBSIZE
KEYS "bull:deliveries.*:*"
EOF
fi

# Summary
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Pipeline Test Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

echo -e "\n${CYAN}Next Steps:${NC}"
echo -e "1. Check provider delivery status:"
echo -e "   ${YELLOW}SELECT channel, status, \"sentAt\", \"deliveredAt\", \"failureReason\" FROM \"Delivery\" \\"
echo -e "    WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE \"externalId\" = '$TEST_USER_ID') \\"
echo -e "    ORDER BY \"createdAt\" DESC;${NC}"
echo -e "\n2. Monitor worker logs:"
echo -e "   ${YELLOW}tail -f /tmp/worker.log | grep -E 'delivery|resend|twilio'${NC}"
echo -e "\n3. Check Bull Board:"
echo -e "   ${YELLOW}http://localhost:3002${NC}"
echo -e "\n4. Check provider dashboards:"
echo -e "   ${YELLOW}Resend: https://resend.com/emails${NC}"
echo -e "   ${YELLOW}Twilio: https://www.twilio.com/console${NC}"

echo -e "\n${CYAN}Event Details:${NC}"
echo -e "  Event ID: ${YELLOW}$EVENT_ID${NC}"
echo -e "  User ID: ${YELLOW}$TEST_USER_ID${NC}"
echo -e "  Email: ${YELLOW}test@example.com${NC}"
echo -e "  Phone: ${YELLOW}+5491123456789${NC}"
echo -e "  Channels: ${YELLOW}email, whatsapp${NC}"
