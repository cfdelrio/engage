-- Add 6 voice EventDefinitions and disabled placeholder Rules for ProdeCaballito.
-- These events are sent by ProdeCaballito BE but had no corresponding EventDefinition
-- in ENGAGE, so they were silently ignored.
--
-- Rules are created as enabled=false. To activate, create a VoiceCampaign in the
-- ENGAGE dashboard and update the rule's actions.campaignId via the UI or SQL.

DO $$
DECLARE
  v_tenant_id text;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'prodecaballito';
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  -- ── EventDefinitions ─────────────────────────────────────────────────────────

  INSERT INTO event_definitions (id, "tenantId", type, schema, version, description, "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid()::text, v_tenant_id, 'prode.voice_nuevo_lider',    '{}', 1, 'Voice: llamada al nuevo líder del ranking',                              now(), now()),
    (gen_random_uuid()::text, v_tenant_id, 'prode.voice_perfect_score',  '{}', 1, 'Voice: llamada al usuario que acertó un exacto',                         now(), now()),
    (gen_random_uuid()::text, v_tenant_id, 'prode.voice_match_reminder', '{}', 1, 'Voice: recordatorio de partido próximo (25-35 min antes del kickoff)',    now(), now()),
    (gen_random_uuid()::text, v_tenant_id, 'prode.voice_weekly_summary', '{}', 1, 'Voice: resumen semanal del ranking',                                      now(), now()),
    (gen_random_uuid()::text, v_tenant_id, 'prode.voice_survey_campeon', '{}', 1, 'Voice: encuesta de predicción de campeón mundial',                        now(), now()),
    (gen_random_uuid()::text, v_tenant_id, 'prode.voice_trash_talk',     '{}', 1, 'Voice: notificación de rivalidad (un usuario superó a otro en el ranking)',now(), now())
  ON CONFLICT ("tenantId", type, version) DO NOTHING;

  -- ── Rules (disabled until a VoiceCampaign is configured for each) ────────────

  INSERT INTO rules (id, "tenantId", name, enabled, priority, conditions, actions, "cooldownSeconds", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, v_tenant_id, 'PC: voice_nuevo_lider → Voice', false, 5,
    '{"operator":"AND","conditions":[{"field":"event.type","operator":"eq","value":"prode.voice_nuevo_lider"}]}',
    '[{"type":"START_VOICE_CAMPAIGN","params":{"campaignId":""}}]',
    86400, now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM rules WHERE "tenantId" = v_tenant_id AND name = 'PC: voice_nuevo_lider → Voice');

  INSERT INTO rules (id, "tenantId", name, enabled, priority, conditions, actions, "cooldownSeconds", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, v_tenant_id, 'PC: voice_perfect_score → Voice', false, 5,
    '{"operator":"AND","conditions":[{"field":"event.type","operator":"eq","value":"prode.voice_perfect_score"}]}',
    '[{"type":"START_VOICE_CAMPAIGN","params":{"campaignId":""}}]',
    86400, now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM rules WHERE "tenantId" = v_tenant_id AND name = 'PC: voice_perfect_score → Voice');

  INSERT INTO rules (id, "tenantId", name, enabled, priority, conditions, actions, "cooldownSeconds", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, v_tenant_id, 'PC: voice_match_reminder → Voice', false, 5,
    '{"operator":"AND","conditions":[{"field":"event.type","operator":"eq","value":"prode.voice_match_reminder"}]}',
    '[{"type":"START_VOICE_CAMPAIGN","params":{"campaignId":""}}]',
    3600, now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM rules WHERE "tenantId" = v_tenant_id AND name = 'PC: voice_match_reminder → Voice');

  INSERT INTO rules (id, "tenantId", name, enabled, priority, conditions, actions, "cooldownSeconds", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, v_tenant_id, 'PC: voice_weekly_summary → Voice', false, 5,
    '{"operator":"AND","conditions":[{"field":"event.type","operator":"eq","value":"prode.voice_weekly_summary"}]}',
    '[{"type":"START_VOICE_CAMPAIGN","params":{"campaignId":""}}]',
    604800, now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM rules WHERE "tenantId" = v_tenant_id AND name = 'PC: voice_weekly_summary → Voice');

  INSERT INTO rules (id, "tenantId", name, enabled, priority, conditions, actions, "cooldownSeconds", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, v_tenant_id, 'PC: voice_survey_campeon → Voice', false, 5,
    '{"operator":"AND","conditions":[{"field":"event.type","operator":"eq","value":"prode.voice_survey_campeon"}]}',
    '[{"type":"START_VOICE_CAMPAIGN","params":{"campaignId":""}}]',
    86400, now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM rules WHERE "tenantId" = v_tenant_id AND name = 'PC: voice_survey_campeon → Voice');

  INSERT INTO rules (id, "tenantId", name, enabled, priority, conditions, actions, "cooldownSeconds", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, v_tenant_id, 'PC: voice_trash_talk → Voice', false, 5,
    '{"operator":"AND","conditions":[{"field":"event.type","operator":"eq","value":"prode.voice_trash_talk"}]}',
    '[{"type":"START_VOICE_CAMPAIGN","params":{"campaignId":""}}]',
    3600, now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM rules WHERE "tenantId" = v_tenant_id AND name = 'PC: voice_trash_talk → Voice');

  RAISE NOTICE 'Added 6 voice EventDefinitions and disabled Rules for tenant prodecaballito.';
END $$;
