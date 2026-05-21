# Event Pipeline API Examples

Base URL: `http://localhost:3001`

## 1. Single Event Ingestion

```bash
curl -X POST http://localhost:3001/v1/events \
  -H "X-API-Key: oek_XXXXX" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "prode.ranking.changed",
    "userId": "user-123",
    "payload": {
      "newRank": 1,
      "previousRank": 5,
      "points": 850
    },
    "idempotencyKey": "rank-change-2024-05-21-001"
  }'
```

Response:

```json
{
  "eventId": "evt_xyz123",
  "status": "queued"
}
```

---

## 2. Batch Event Ingestion

Ingerir múltiples eventos en una sola request:

```bash
curl -X POST http://localhost:3001/v1/events/batch \
  -H "X-API-Key: oek_XXXXX" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "type": "prode.goal.scored",
      "userId": "user-123",
      "payload": {
        "team": "Argentina",
        "scorer": "Messi",
        "minute": 45
      }
    },
    {
      "type": "prode.goal.scored",
      "userId": "user-456",
      "payload": {
        "team": "Argentina",
        "scorer": "Messi",
        "minute": 45
      }
    },
    {
      "type": "user.inactive",
      "userId": "user-789",
      "payload": {
        "daysInactive": 7
      }
    }
  ]'
```

Response:

```json
{
  "batchId": "batch_1621507200000_a3x9z1k",
  "total": 3,
  "succeeded": 3,
  "failed": 0,
  "events": [
    {
      "eventId": "evt_abc123",
      "userId": "user-123",
      "status": "queued"
    },
    {
      "eventId": "evt_def456",
      "userId": "user-456",
      "status": "queued"
    },
    {
      "eventId": "evt_ghi789",
      "userId": "user-789",
      "status": "queued"
    }
  ]
}
```

---

## 3. Replay an Event

Re-procesar un evento existente (útil para debugging o testing):

```bash
curl -X POST http://localhost:3001/v1/events/evt_xyz123/replay \
  -H "X-API-Key: oek_XXXXX"
```

Response:

```json
{
  "originalEventId": "evt_xyz123",
  "replayEventId": "evt_replay_new123",
  "status": "queued"
}
```

---

## 4. Get Worker Health Metrics

Monitorear el estado de las queues de workers:

```bash
curl http://localhost:3001/v1/events/health/workers
```

Response:

```json
{
  "status": "healthy",
  "queues": {
    "events.incoming": {
      "name": "events.incoming",
      "active": 5,
      "completed": 1245,
      "failed": 3,
      "delayed": 0,
      "paused": 0,
      "waiting": 12
    },
    "deliveries.scheduled": {
      "name": "deliveries.scheduled",
      "active": 8,
      "completed": 2341,
      "failed": 1,
      "delayed": 0,
      "paused": 0,
      "waiting": 34
    },
    "deliveries.email": {
      "name": "deliveries.email",
      "active": 3,
      "completed": 856,
      "failed": 2,
      "delayed": 5,
      "paused": 0,
      "waiting": 7
    },
    "deliveries.sms": {
      "name": "deliveries.sms",
      "active": 2,
      "completed": 523,
      "failed": 0,
      "delayed": 0,
      "paused": 0,
      "waiting": 4
    },
    "deliveries.push": {
      "name": "deliveries.push",
      "active": 1,
      "completed": 1203,
      "failed": 1,
      "delayed": 0,
      "paused": 0,
      "waiting": 2
    },
    "deliveries.voice": {
      "name": "deliveries.voice",
      "active": 0,
      "completed": 145,
      "failed": 2,
      "delayed": 2,
      "paused": 0,
      "waiting": 0
    },
    "deliveries.whatsapp": {
      "name": "deliveries.whatsapp",
      "active": 4,
      "completed": 678,
      "failed": 1,
      "delayed": 0,
      "paused": 0,
      "waiting": 8
    }
  },
  "timestamp": "2024-05-21T14:30:45.123Z"
}
```

---

## 5. Get Event Details with Processing Logs

```bash
curl http://localhost:3001/v1/events/evt_xyz123 \
  -H "X-API-Key: oek_XXXXX"
```

Response:

```json
{
  "id": "evt_xyz123",
  "tenantId": "tenant_123",
  "userId": "user_456",
  "type": "prode.ranking.changed",
  "payload": {
    "newRank": 1,
    "previousRank": 5,
    "points": 850
  },
  "metadata": {
    "source": "mobile-app",
    "version": "2.1.0"
  },
  "idempotencyKey": "rank-change-2024-05-21-001",
  "sourceIp": "192.168.1.100",
  "receivedAt": "2024-05-21T14:25:30.000Z",
  "processedAt": "2024-05-21T14:25:31.234Z",
  "processingLogs": [
    {
      "id": "log_1",
      "eventId": "evt_xyz123",
      "step": "rules_evaluation",
      "status": "success",
      "details": {
        "rulesMatched": 2,
        "ruleIds": ["rule_123", "rule_456"]
      },
      "processedAt": "2024-05-21T14:25:30.500Z"
    },
    {
      "id": "log_2",
      "eventId": "evt_xyz123",
      "step": "engagement_decision",
      "status": "success",
      "details": {
        "decisionsCreated": 2,
        "channels": ["push", "email"]
      },
      "processedAt": "2024-05-21T14:25:31.000Z"
    },
    {
      "id": "log_3",
      "eventId": "evt_xyz123",
      "step": "queue_delivery",
      "status": "success",
      "details": {
        "deliveryJobsEnqueued": 2
      },
      "processedAt": "2024-05-21T14:25:31.234Z"
    }
  ]
}
```

---

## Event Pipeline Flow

```
POST /events (or /events/batch)
    ↓
[API validation + deduplication]
    ↓
[Persist Event in DB]
    ↓
[Publish to WebSocket stream]
    ↓
[Enqueue to events.incoming]
    ↓
[Worker: Event Processor] ←─── GET /health/workers to monitor
    ├── Load user context
    ├── Evaluate rules
    ├── Create engagement decisions
    └── Enqueue to deliveries.scheduled
        ↓
    [Worker: Delivery Scheduler]
    ├── Check frequency caps
    ├── Check quiet hours
    ├── Check unsubscribes
    └── Route to channel queues
        ├── deliveries.email
        ├── deliveries.sms
        ├── deliveries.push
        ├── deliveries.voice
        └── deliveries.whatsapp
            ↓
        [Channel Workers] Send via provider
            ↓
        [Webhooks] Update delivery status
            ↓
        GET /events/:eventId → See processing logs
```

---

## Error Handling

### Duplicate Event (409)

```json
{
  "error": "Duplicate event",
  "idempotencyKey": "rank-change-2024-05-21-001"
}
```

### Event Not Found (404)

```json
{
  "error": "Event not found"
}
```

### Batch with Mixed Results

```json
{
  "batchId": "batch_123",
  "total": 3,
  "succeeded": 2,
  "failed": 1,
  "events": [
    { "eventId": "evt_1", "userId": "user-1", "status": "queued" },
    { "eventId": "evt_2", "userId": "user-2", "status": "queued" },
    {
      "userId": "user-3",
      "status": "error",
      "error": "Missing required field: type"
    }
  ]
}
```
