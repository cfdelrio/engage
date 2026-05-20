# ORKESTAI ENGAGE — Comprehensive Test Plan

## Unit Tests

### Packages

#### `@engage/channels` (Twilio Voice Provider)
- TwiML generation with various configurations
- Webhook parsing (call-status, DTMF, recording)
- Error handling and edge cases
- Signature verification

#### `@engage/rules-engine`
- Condition evaluation (AND/OR/nested)
- Action collection from matched rules
- Rule execution flow
- Cooldown enforcement

#### `@engage/ai`
- Sentiment analysis with Claude API
- Emotional tone generation
- Provider registry resolution (tenant → flag → global)
- Error fallbacks

#### `@engage/analytics`
- Engagement score calculation
- Fatigue score computation
- Metric aggregation

#### `@engage/core`
- Quiet hours calculation (timezone-aware)
- API key hashing
- Config encryption

## Integration Tests

### Workers (`@engage/worker`)
- Event processing pipeline
- Voice call job processing
- Delivery scheduling
- Retry logic and backoff

### API Routes (`@engage/api`)
- Voice campaign CRUD
- Rule management
- Webhook handling
- Idempotency

## E2E Tests

### Full Flows
1. Create campaign → Trigger → Call → Webhook → Status update
2. Event ingestion → Rule evaluation → Decision → Delivery
3. AI consultation → Override handling → Final decision

## Test Infrastructure

- Vitest configuration per package
- Docker-based test databases (PostgreSQL, Redis)
- Twilio API mocking
- Claude API mocking
- Fixtures and factories

## Coverage Goals

- Core packages: 80%+
- Workers: 75%+
- API: 70%+
- Overall: 75%+

## Estimated Timeline

- Unit tests: 2-3 days
- Integration tests: 2-3 days
- E2E tests: 1-2 days
- Setup & tooling: 1-2 days

**Total: 6-10 days**
