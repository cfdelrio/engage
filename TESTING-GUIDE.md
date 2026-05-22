# ORKESTAI ENGAGE — Testing Guide

## Quick Start on EC2

### Prerequisites

Verify services are running on EC2:

```bash
# Terminal 1: Check worker
ps aux | grep "node apps/worker/dist/index.js"

# Terminal 2: Check API
ps aux | grep "node apps/api/dist/index.js"

# Verify Redis
redis-cli ping  # Should return PONG

# Verify PostgreSQL
psql -h localhost -U engage -d engage -c "SELECT 1"
```

If services are **not running**, start them:

```bash
cd /home/user/engage

# Load environment and start services
set -a
source .env
set +a

# Terminal 1: Worker
NODE_ENV=production node apps/worker/dist/index.js > /tmp/worker.log 2>&1 &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID"

# Terminal 2: API
NODE_ENV=production node apps/api/dist/index.js > /tmp/api.log 2>&1 &
API_PID=$!
echo "API PID: $API_PID"

sleep 2

# Verify logs
tail -20 /tmp/worker.log
tail -20 /tmp/api.log
```

### Full Pipeline Test

Execute the comprehensive test script:

```bash
cd /home/user/engage
./test-pipeline-ec2.sh
```

**Expected output:**

```
═══════════════════════════════════════════════════════════
ORKESTAI ENGAGE — Full Pipeline Test with Real Credentials
═══════════════════════════════════════════════════════════

✓ Credentials loaded from .env
  - RESEND_API_KEY: re_12345678...
  - TWILIO_ACCOUNT_SID: AC12345678...

[1/6] Getting ProdeCaballito API Key...
✓ Found API key: oek_fodgj08jkgme...

[2/6] Verifying Tenant and Event Definitions...
✓ Tenant: prodecaballito (cmpg88n1d...)
✓ Event Definitions: 26
✓ Templates: 37
✓ Rules: 26

[3/6] Sending Test Event (prode.result_published.individual)...
✓ Event sent: clx...

[4/6] Waiting for Processing (12s)...
  ✓ Processing window complete

[5/6] Verifying Pipeline State...
  Checking Event... ✓
  Checking RuleExecution... ✓ 2 matched
  Checking EngagementDecision... ✓ 2 decisions
  Checking Delivery... ✓
    - email (resend): queued (×1)
    - whatsapp (twilio): queued (×1)

[6/6] Checking BullMQ Queue Status...
  Checking Redis queues... ✓ All queues idle
```

## Manual Testing Steps

If you prefer to test step-by-step:

### Step 1: Get API Key

```bash
psql -h localhost -U engage -d engage -t -c \
  "SELECT \"keyHash\" FROM \"TenantApiKey\" k \
   JOIN \"Tenant\" t ON k.\"tenantId\" = t.id \
   WHERE t.slug = 'prodecaballito' LIMIT 1"
```

### Step 2: Send Test Event

```bash
API_KEY="oek_fodgj08jkgme26924m4zi9"  # Replace with actual key

curl -X POST http://localhost:3001/v1/events \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "type": "prode.result_published.individual",
    "userId": "test_victory_final",
    "idempotencyKey": "result:user_victory_final:match_1337",
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
        "outcome": "exacto"
      }
    },
    "metadata": {
      "channels_hint": ["email", "whatsapp"],
      "user_contact": {
        "nombre": "Carlos Test",
        "email": "carlos@test.com",
        "phone": "+5491123456789",
        "whatsapp_consent": true,
        "idioma_pref": "es"
      }
    }
  }'
```

**Expected response (202 Accepted):**

```json
{
  "eventId": "clx1234567890abcdefghijk",
  "status": "queued"
}
```

### Step 3: Wait for Processing

```bash
# Wait 12 seconds for async processing
sleep 12
```

### Step 4: Verify Event Created

```bash
psql -h localhost -U engage -d engage -c \
  "SELECT id, type, \"userId\", \"processedAt\" FROM \"Event\" \
   WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE \"externalId\" = 'test_victory_final') \
   ORDER BY \"createdAt\" DESC LIMIT 1"
```

**Expected output:**

```
                  id                  |            type             | userId | processedAt
--------------------------------------+-----------------------+--------+-----------
 clx1234567890abcdefghijk | prode.result_published.individual | uuid... | [timestamp]
```

### Step 5: Verify Rules Matched

```bash
psql -h localhost -U engage -d engage -c \
  "SELECT r.name, re.matched, re.reasoning FROM \"RuleExecution\" re \
   JOIN \"Rule\" r ON re.\"ruleId\" = r.id \
   WHERE re.\"eventId\" IN (
     SELECT id FROM \"Event\" WHERE \"userId\" IN (
       SELECT id FROM \"User\" WHERE \"externalId\" = 'test_victory_final'
     )
   ) \
   ORDER BY re.\"executedAt\" DESC LIMIT 5"
```

**Expected output:**

```
               name              | matched |                reasoning
---------------------------------+---------+--------+----+----
 PC: resultado individual → email + wa |    t    | {"category":"all","channels":["email","whatsapp"]}
```

### Step 6: Verify Engagement Decisions

```bash
psql -h localhost -U engage -d engage -c \
  "SELECT id, channel, \"decisionType\", \"scheduledFor\" FROM \"EngagementDecision\" \
   WHERE \"eventId\" IN (
     SELECT id FROM \"Event\" WHERE \"userId\" IN (
       SELECT id FROM \"User\" WHERE \"externalId\" = 'test_victory_final'
     )
   ) \
   ORDER BY \"createdAt\" DESC LIMIT 5"
```

**Expected output:**

```
                  id                  | channel  | decisionType | scheduledFor
--------------------------------------+----------+--------------+----------------------
 dee1234567890abcdefghijk | email    | send     | 2026-05-22T...
 dee1234567890abcdefghijk | whatsapp | send     | 2026-05-22T...
```

### Step 7: Verify Deliveries

```bash
psql -h localhost -U engage -d engage -c \
  "SELECT id, channel, provider, status, \"sentAt\", \"deliveredAt\", \"failureReason\" FROM \"Delivery\" \
   WHERE \"userId\" IN (
     SELECT id FROM \"User\" WHERE \"externalId\" = 'test_victory_final'
   ) \
   ORDER BY \"createdAt\" DESC LIMIT 5"
```

**Expected output after providers process:**

```
                  id                  | channel  | provider |  status   |      sentAt       |   deliveredAt     | failureReason
--------------------------------------+----------+----------+-----------+-------------------+-------------------+---------------
 dlv1234567890abcdefghijk | email    | resend   | sent      | 2026-05-22... | 2026-05-22... |
 dlv1234567890abcdefghijk | whatsapp | twilio   | sent      | 2026-05-22... |                 |
```

### Step 8: Check Worker Logs

```bash
# Real-time logs
tail -f /tmp/worker.log

# Grep for delivery events
tail -50 /tmp/worker.log | grep -i "delivery\|resend\|twilio\|whatsapp"
```

**Expected logs:**

```
[2026-05-22T10:30:45Z] [event-processor] Event clx... type=prode.result_published.individual
[2026-05-22T10:30:45Z] [event-processor] Matched 2 rules, 2 decisions created
[2026-05-22T10:30:46Z] [delivery-scheduler] Email delivery scheduled for user test_victory_final
[2026-05-22T10:30:46Z] [delivery-scheduler] WhatsApp delivery scheduled for user test_victory_final
[2026-05-22T10:30:47Z] [resend-worker] Sending email via Resend...
[2026-05-22T10:30:47Z] [twilio-worker] Sending WhatsApp via Twilio...
[2026-05-22T10:30:48Z] [resend-worker] Email sent: msg_1234567890
[2026-05-22T10:30:49Z] [twilio-worker] WhatsApp sent: SM1234567890abcdef
```

### Step 9: Check Bull Board Queue Status

Open in browser:

```
http://localhost:3002
```

**Expected state:**

- **events.incoming**: 0 jobs (completed)
- **deliveries.scheduled**: 0 jobs (completed)
- **deliveries.email**: 0 jobs (completed or in progress)
- **deliveries.whatsapp**: 0 jobs (completed or in progress)

## Troubleshooting

### Problem: "Cannot connect to PostgreSQL"

```bash
# Verify connection
psql -h localhost -U engage -d engage -c "SELECT 1"

# Check if PostgreSQL is running
sudo systemctl status postgresql-16

# Start if needed
sudo systemctl start postgresql-16
```

### Problem: "Redis connection refused"

```bash
# Check if Redis is running
redis-cli ping  # Should return PONG

# Start if needed
sudo systemctl start redis-server
```

### Problem: "API not responding on port 3001"

```bash
# Check if API is running
curl http://localhost:3001/health

# Check API logs
tail -50 /tmp/api.log | grep -i error

# Kill and restart
pkill -f "node apps/api"
NODE_ENV=production node apps/api/dist/index.js > /tmp/api.log 2>&1 &
```

### Problem: "Delivery status stuck on 'queued'"

This is expected if webhooks haven't been received yet. Providers take time to process.

```bash
# 1. Check worker is processing
tail -f /tmp/worker.log | grep -E "delivery|resend|twilio"

# 2. Verify provider credentials
echo "RESEND_API_KEY: $RESEND_API_KEY"
echo "TWILIO_ACCOUNT_SID: $TWILIO_ACCOUNT_SID"

# 3. Check for failed jobs
psql -h localhost -U engage -d engage -c \
  "SELECT * FROM \"Delivery\" WHERE \"failureReason\" IS NOT NULL \
   ORDER BY \"createdAt\" DESC LIMIT 5"

# 4. Check provider dashboards
# Resend: https://resend.com/emails
# Twilio: https://www.twilio.com/console/sms
```

### Problem: "Rules not matching"

```bash
# Check rules were created
psql -h localhost -U engage -d engage -c \
  "SELECT id, name, enabled, priority FROM \"Rule\" \
   WHERE \"tenantId\" = (SELECT id FROM \"Tenant\" WHERE slug = 'prodecaballito') \
   ORDER BY priority DESC"

# Check rule execution logs
psql -h localhost -U engage -d engage -c \
  "SELECT r.name, re.matched, re.reasoning FROM \"RuleExecution\" re \
   JOIN \"Rule\" r ON re.\"ruleId\" = r.id \
   WHERE re.\"eventId\" = 'YOUR_EVENT_ID' \
   ORDER BY re.\"executedAt\" DESC"
```

## Performance Metrics

After a successful test, you can check metrics:

```bash
# Event processing time
psql -h localhost -U engage -d engage -c \
  "SELECT type, COUNT(*) as count, \
           ROUND(AVG(EXTRACT(EPOCH FROM (\"processedAt\" - \"createdAt\")))::numeric, 3) as avg_secs \
   FROM \"Event\" \
   WHERE \"createdAt\" > NOW() - INTERVAL '1 hour' AND \"userId\" IN (
     SELECT id FROM \"User\" WHERE \"externalId\" LIKE 'test_%'
   ) \
   GROUP BY type"

# Delivery status breakdown
psql -h localhost -U engage -d engage -c \
  "SELECT channel, status, COUNT(*) as count FROM \"Delivery\" \
   WHERE \"createdAt\" > NOW() - INTERVAL '1 hour' \
   GROUP BY channel, status \
   ORDER BY channel, status"
```

## Next Steps

After verifying the pipeline works:

1. **Monitor Real Production Events**: Replace test events with actual ProdeCaballito events
2. **Set Up Webhook Handling**: Configure Resend and Twilio to send webhooks to `/webhooks/resend` and `/webhooks/twilio`
3. **Test Preference Center**: Access the public preference center with a token
4. **Load Testing**: Use `k6` to stress-test the pipeline with 100+ events/sec

---

For more details, see:

- `RUNBOOK.md` — Full production deployment guide
- `test-e2e.sh` — Minimal end-to-end test
- `test-pipeline-ec2.sh` — Comprehensive pipeline test
