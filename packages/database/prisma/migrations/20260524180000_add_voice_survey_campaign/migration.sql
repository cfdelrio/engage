-- Data migration: create voice survey campaign for ProdeCaballito
-- and wire the existing (disabled) voice_survey rule to use START_VOICE_CAMPAIGN.
--
-- Flow: prode.voice_survey event → rule fires → trigger endpoint creates
-- an ephemeral orkestai-voice campaign per user using these flow steps.

DO $$
DECLARE
  v_tenant_id  TEXT;
  v_campaign_id TEXT;
  v_flow_steps  JSONB;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'prodecaballito';
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'Tenant prodecaballito not found – skipping voice survey migration.';
    RETURN;
  END IF;

  -- Skip if campaign already exists (idempotent)
  IF EXISTS (
    SELECT 1 FROM voice_campaigns
    WHERE "tenantId" = v_tenant_id AND name = 'Encuesta de voz - ProdeCaballito'
  ) THEN
    RAISE NOTICE 'Voice survey campaign already exists – skipping.';
    RETURN;
  END IF;

  v_campaign_id := 'vc_survey_' || replace(gen_random_uuid()::text, '-', '');

  v_flow_steps := '[
    {
      "id": "s1",
      "type": "say",
      "text": "Hola, te llama ProdeCaballito. Gracias por participar del torneo. Te hacemos una pregunta rápida."
    },
    {
      "id": "s2",
      "type": "dtmf_question",
      "text": "¿Cómo calificás tu experiencia con el prode esta semana? Presioná 1 para excelente, 2 para buena, o 3 para regular.",
      "options": { "1": "excelente", "2": "buena", "3": "regular" },
      "timeout": 10
    },
    {
      "id": "s3",
      "type": "say",
      "text": "¡Muchas gracias por tu respuesta! Seguí apostando y que gane el mejor. ¡Hasta pronto!"
    }
  ]'::jsonb;

  INSERT INTO voice_campaigns (
    id, "tenantId", name, description, status,
    "triggerType", "eventType",
    "flowSteps", "ttsProvider",
    "aiInstructions",
    script, "voiceConfig", "audienceFilter",
    "audienceSize", stats,
    "createdAt", "updatedAt"
  ) VALUES (
    v_campaign_id,
    v_tenant_id,
    'Encuesta de voz - ProdeCaballito',
    'Encuesta de satisfacción por llamada para usuarios del prode. Disparada por regla event-based.',
    'draft',
    'event-based',
    'prode.voice_survey',
    v_flow_steps,
    'elevenlabs',
    'Hablá con entusiasmo futbolero argentino, amigable y cercano. Sé breve y claro.',
    '',
    '{}'::jsonb,
    '{}'::jsonb,
    0,
    '{"sent": 0, "answered": 0, "completed": 0, "failed": 0, "avgDuration": 0}'::jsonb,
    NOW(),
    NOW()
  );

  -- Enable the voice_survey rule and switch action to START_VOICE_CAMPAIGN
  UPDATE rules
  SET
    enabled  = true,
    actions  = jsonb_build_array(
                 jsonb_build_object(
                   'type', 'START_VOICE_CAMPAIGN',
                   'params', jsonb_build_object('campaignId', v_campaign_id)
                 )
               ),
    "updatedAt" = NOW()
  WHERE "tenantId" = v_tenant_id
    AND name       = 'PC: voice_survey → Voice (TODO: validate script)';

  RAISE NOTICE 'Voice survey campaign created: %', v_campaign_id;
END $$;
