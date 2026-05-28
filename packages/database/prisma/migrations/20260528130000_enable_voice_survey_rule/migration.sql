-- Create VoiceCampaign for prode.voice_survey and enable the rule.
--
-- ProdeCaballito emits prode.voice_survey after 5-day reminder cycle.
-- Payload: business_context.tournament_info, pending_count.
--
-- The rule "PC: voice_survey → Encuesta de voz" exists in DB (from seed) but is
-- disabled and may have a stale campaignId. This migration creates or finds the
-- VoiceCampaign and wires it to the rule.

DO $$
DECLARE
  v_tenant_id TEXT;
  v_campaign_id TEXT;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

  -- Reuse existing campaign if it was already created (e.g., via direct SQL fix)
  SELECT id INTO v_campaign_id
  FROM voice_campaigns
  WHERE "tenantId" = v_tenant_id
    AND name = 'Encuesta de voz - ProdeCaballito'
  LIMIT 1;

  IF v_campaign_id IS NULL THEN
    v_campaign_id := gen_random_uuid()::text;

    INSERT INTO voice_campaigns (
      id, "tenantId", name, description, status, "triggerType", "eventType",
      "voiceConfig", script, "aiGenerated", "audienceFilter",
      "maxRetries", stats, "audienceSize", "flowSteps",
      "ttsProvider", "elevenLabsVoiceId", "createdAt", "updatedAt"
    ) VALUES (
      v_campaign_id,
      v_tenant_id,
      'Encuesta de voz - ProdeCaballito',
      'Encuesta de satisfacción por llamada para usuarios del prode. Disparada por regla event-based.',
      'active',
      'event-based',
      'prode.voice_survey',
      '{}',
      '',
      false,
      '{}',
      2,
      '{"sent": 0, "answered": 0, "completed": 0, "failed": 0, "avgDuration": 0}',
      0,
      '[
        {"id": "s1", "type": "say", "text": "Hola. Te llama ProdeCaballito. Tenemos una pregunta rapida sobre tu experiencia de esta semana. Solo te tomara diez segundos."},
        {"id": "s2", "type": "dtmf_question", "text": "Como calificas tu experiencia jugando el prode esta semana? Presiona 1 si estuvo buenisima, 2 si estuvo bien, o 3 si hay algo para mejorar.", "options": {"1": "excelente", "2": "buena", "3": "mejorable"}, "timeout": 10},
        {"id": "s3", "type": "say", "text": "Muchisimas gracias por tu respuesta. Tu opinion nos ayuda a mejorar el prode. Segui jugando y que gane el mejor."}
      ]',
      'elevenlabs',
      'sOwJCppWuH3vZrwPgwJQ',
      NOW(),
      NOW()
    );
  END IF;

  -- Update existing rule (seeded as disabled with empty or stale campaignId)
  UPDATE rules SET
    enabled = true,
    actions = jsonb_build_array(
      jsonb_build_object(
        'type', 'START_VOICE_CAMPAIGN',
        'params', jsonb_build_object('campaignId', v_campaign_id)
      )
    ),
    "updatedAt" = NOW()
  WHERE name = 'PC: voice_survey → Encuesta de voz'
    AND "tenantId" = v_tenant_id;

  -- If rule didn't exist in DB (seed not run or older seed), create it
  IF NOT FOUND THEN
    INSERT INTO rules (
      id, "tenantId", name, priority, enabled, conditions, actions,
      "cooldownSeconds", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(),
      v_tenant_id,
      'PC: voice_survey → Encuesta de voz',
      5,
      true,
      '{"eventType": "prode.voice_survey"}',
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
