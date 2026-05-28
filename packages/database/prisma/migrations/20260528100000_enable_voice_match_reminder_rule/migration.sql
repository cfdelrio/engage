-- Create VoiceCampaign for prode.voice_match_reminder and enable the rule.
--
-- ProdeCaballito emits prode.voice_match_reminder when a match starts in 25-35 min.
-- Payload: business_context.home_team, away_team, minutes_to_kickoff, bet_local, bet_visitante.
--
-- The rule "PC: voice_match_reminder → Voice" exists in DB (from seed) but is
-- disabled and has campaignId = "". This migration creates the VoiceCampaign
-- and wires it to the rule.

DO $$
DECLARE
  v_tenant_id TEXT;
  v_campaign_id TEXT;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

  v_campaign_id := gen_random_uuid()::text;

  INSERT INTO voice_campaigns (
    id, "tenantId", name, description, status, "triggerType", "eventType",
    "voiceConfig", script, "aiGenerated", "audienceFilter",
    "maxRetries", stats, "audienceSize", "flowSteps", "createdAt", "updatedAt"
  ) VALUES (
    v_campaign_id,
    v_tenant_id,
    'Recordatorio de partido próximo',
    'Llamada cuando un partido empieza en menos de 35 minutos',
    'active',
    'event-based',
    'prode.voice_match_reminder',
    '{}',
    '¡Hola! Te llama ProdeCaballito. Hay un partido próximo y el cierre de pronósticos está por terminar. ¡Entrá ya y cargá tu apuesta!',
    false,
    '{}',
    2,
    '{"sent": 0, "answered": 0, "completed": 0, "failed": 0, "avgDuration": 0}',
    0,
    '[
      {"id": "s1", "type": "say", "text": "¡Hola! Te llama ProdeCaballito. Tenés un partido que empieza pronto y el cierre de pronósticos está por terminar. ¡Entrá ya a ProdeCaballito y cargá tu apuesta antes de que sea tarde!"},
      {"id": "s2", "type": "say", "text": "¡Buena suerte y que empiece el partido!"}
    ]',
    NOW(),
    NOW()
  );

  -- Update existing rule (seeded as disabled with empty campaignId)
  UPDATE rules SET
    enabled = true,
    actions = jsonb_build_array(
      jsonb_build_object(
        'type', 'START_VOICE_CAMPAIGN',
        'params', jsonb_build_object('campaignId', v_campaign_id)
      )
    ),
    "updatedAt" = NOW()
  WHERE name = 'PC: voice_match_reminder → Voice'
    AND "tenantId" = v_tenant_id;

  -- If rule didn't exist in DB (seed not run or older seed), create it
  IF NOT FOUND THEN
    INSERT INTO rules (
      id, "tenantId", name, priority, enabled, conditions, actions,
      "cooldownSeconds", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(),
      v_tenant_id,
      'PC: voice_match_reminder → Voice',
      5,
      true,
      '{"eventType": "prode.voice_match_reminder"}',
      jsonb_build_array(
        jsonb_build_object(
          'type', 'START_VOICE_CAMPAIGN',
          'params', jsonb_build_object('campaignId', v_campaign_id)
        )
      ),
      3600,
      NOW(),
      NOW()
    );
  END IF;
END $$;
