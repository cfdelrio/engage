# ProdeCABallito Voice Survey Generator Prompt

Use this prompt when asking Claude to create voice campaign surveys for ProdeCABallito users.

---

## Base System Prompt

```
You are a voice survey specialist for ProdeCABallito, a sports betting platform.
Your job is to create engaging, conversational voice survey prompts that will be
delivered via phone calls to Prode community members.

You understand:
- Prode users love discussing matches, rankings, and their predictions
- Surveys must be quick (30-60 seconds max) to avoid hangs-up
- Questions should feel natural when spoken aloud
- Spanish (Argentina dialect) is preferred
- Users expect personalization (their name, rankings, favorite teams)

Always output valid JSON that matches the Engage survey format.
```

---

## Usage Examples

### Prompt 1: NPS Survey (Net Promoter Score)

**Your question for Claude:**

```
Create a voice survey for ProdeCABallito asking about user satisfaction
with our match predictions. User's name is {{firstName}}, and they've been
using Prode for {{accountAge}}. Keep it conversational and ask for a 1-10 scale.
```

**Claude should respond with:**

```json
{
  "prompt": "Hola {{firstName}}, gracias por ser parte de ProdeCABallito. Queremos saber: ¿qué tan probable es que recomiendes nuestras predicciones de partidos a un amigo? Presiona cualquier número del 1 al 10, donde 1 es nada probable y 10 es muy probable.",
  "variables": {
    "firstName": "required",
    "accountAge": "optional"
  },
  "expectedResponses": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  "language": "es-AR",
  "duration_seconds": 35
}
```

### Prompt 2: Ranking Interest Survey

**Your question for Claude:**

```
Create a voice survey asking ProdeCABallito users if they'd be interested
in a new feature: real-time ranking updates via WhatsApp. The user's current
ranking is {{rankingPosition}} and they have {{winStreak}} wins in a row.
```

**Claude should respond with:**

```json
{
  "prompt": "¡Hola {{firstName}}! ¡Felicitaciones por ser {{rankingPosition}} en la tabla! Tenemos una novedad: ¿te gustaría recibir actualizaciones de rankings en tiempo real por WhatsApp después de cada fecha? Presiona 1 si te interesa, 2 si quizás, o 3 si prefieres que no.",
  "variables": {
    "firstName": "required",
    "rankingPosition": "required",
    "winStreak": "optional"
  },
  "expectedResponses": ["1", "2", "3"],
  "language": "es-AR",
  "duration_seconds": 28
}
```

### Prompt 3: Event Feedback Survey

**Your question for Claude:**

```
Create a voice survey asking if a user liked a specific match we provided
results for. They predicted {{prediction}} for {{matchTeams}}, and the actual
result was {{actualResult}}. Ask if they'll use our service for the next matchday.
```

**Claude should respond with:**

```json
{
  "prompt": "Hola {{firstName}}, te recordamos que vos predijiste {{prediction}} en {{matchTeams}}, y el resultado fue {{actualResult}}. ¿Te pareció útil nuestra información? Presiona 1 si sí, 2 si no, o 3 si es lo mismo.",
  "variables": {
    "firstName": "required",
    "prediction": "required",
    "matchTeams": "required",
    "actualResult": "required"
  },
  "expectedResponses": ["1", "2", "3"],
  "language": "es-AR",
  "duration_seconds": 25
}
```

### Prompt 4: Churn Prevention Survey

**Your question for Claude:**

```
Create a voice survey for a user who hasn't predicted in {{daysSinceLastPrediction}} days.
The goal is to understand why and re-engage them. The user's all-time rank is {{allTimeRank}}.
```

**Claude should respond with:**

```json
{
  "prompt": "Hola {{firstName}}, notamos que hace {{daysSinceLastPrediction}} días que no haces predicciones. Tu ranking histórico es {{allTimeRank}}, ¡que es muy bueno! ¿Hay algo que podamos hacer mejor? Presiona 1 si te falta tiempo, 2 si no está emocionante ahora, o 3 si hay otro motivo.",
  "variables": {
    "firstName": "required",
    "daysSinceLastPrediction": "required",
    "allTimeRank": "required"
  },
  "expectedResponses": ["1", "2", "3"],
  "language": "es-AR",
  "duration_seconds": 30
}
```

---

## Variables Available

### User Context

- `{{firstName}}` — User's first name
- `{{lastName}}` — User's last name
- `{{email}}` — User's email
- `{{phone}}` — User's phone (E.164 format)

### Prode-Specific

- `{{rankingPosition}}` — User's current ranking (e.g., "3")
- `{{allTimeRank}}` — User's all-time ranking
- `{{winStreak}}` — Current consecutive wins
- `{{predictionsThisMonth}}` — Number of predictions this month
- `{{accuracyRate}}` — Prediction accuracy (e.g., "78%")
- `{{favoriteTeam}}` — User's favorite team

### Match/Event Context

- `{{matchTeams}}` — Match description (e.g., "Argentina vs Brasil")
- `{{prediction}}` — What the user predicted
- `{{actualResult}}` — What actually happened
- `{{daysSinceLastPrediction}}` — Days of inactivity
- `{{accountAge}}` — How long the user has been with Prode

---

## Guidelines for Effective ProdeCABallito Surveys

### ✅ Do This

- **Start with personalization** — Use {{firstName}} and Prode-specific stats
- **Reference their passion** — Mention rankings, win streaks, favorite teams
- **Keep it brief** — 25-35 seconds is ideal
- **Use DTMF numbers** — "Press 1 for Yes, 2 for No" is understood by everyone
- **Add context** — Remind them of their last prediction or ranking
- **Celebrate wins** — "¡Felicitaciones por ser 5° en la tabla!"
- **Honor their time** — "Only takes 10 seconds"

### ❌ Don't Do This

- ❌ Ask about multiple unrelated things in one call
- ❌ Use vague questions like "How was your experience?"
- ❌ Ignore their ranking or recent activity
- ❌ Make assumptions about their sports knowledge
- ❌ Sell aggressively ("You MUST try...")
- ❌ Call during quiet hours (early morning, late night)
- ❌ Repeat variables they might not have (e.g., {{favoriteTeam}} if unknown)

---

## Create Your Survey

When you need a new survey, ask Claude with this structure:

```
CREATE A VOICE SURVEY FOR PRODECABALLITO

Use Case: [NPS / Ranking Feature / Match Feedback / Churn Prevention / Other]

Target User:
- Ranking: {{rankingPosition}}
- Activity: [recently active / inactive for X days / seasonal]
- Context: [relevant match, streak, or feature]

Question Goal: [What you want to learn from them]

Variables to Include: [{{variable1}}, {{variable2}}, ...]

Tone: [Professional / Friendly / Celebratory / Concerned]
```

**Example:**

```
CREATE A VOICE SURVEY FOR PRODECABALLITO

Use Case: Churn Prevention

Target User:
- Ranking: Top 100 historically
- Activity: Inactive for 14 days
- Context: Was very active last season

Question Goal: Understand why they stopped predicting

Variables to Include: {{firstName}}, {{daysSinceLastPrediction}}, {{allTimeRank}}

Tone: Friendly and concerned
```

Then Claude will generate the JSON survey ready to use with Engage's `/admin/voice-campeon-survey` endpoint.

---

## Integration with Engage API

Once Claude generates your survey JSON, store it:

```bash
curl -X POST https://engage.orkestai.ar/admin/voice-campeon-survey \
  -H "x-api-key: YOUR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "prompt": "Hola {{firstName}}, ¿qué tal tu experiencia en ProdeCABallito?",
    "variables": {
      "firstName": "Carlos",
      "rankingPosition": "5"
    },
    "ttl": 86400
  }'
```

Response:

```json
{
  "surveyId": "survey_1234567890_xyz789",
  "prompt": "Hola {{firstName}}, ¿qué tal tu experiencia en ProdeCABallito?",
  "expiresIn": 86400
}
```

Use the `surveyId` in voice campaign configurations.

---

## Best Practices

1. **Test pronunciation** — Read the prompt aloud to check pacing and clarity
2. **Use realistic examples** — Reference actual match results and rankings
3. **A/B test tone** — Try celebratory vs. neutral, see what gets responses
4. **Monitor response rates** — Adjust based on how many users respond
5. **Respect quiet hours** — Don't call before 8 AM or after 9 PM
6. **Honor frequency caps** — Max 1 survey call per user per week
7. **Log responses** — Track which DTMF codes users press (1, 2, 3, etc.)
