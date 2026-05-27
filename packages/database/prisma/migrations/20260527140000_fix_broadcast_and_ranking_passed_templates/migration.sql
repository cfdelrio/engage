-- Fix 1: sms_ranking_passed variables
-- Template uses {{user.planilla_nombre}} and {{business_context.ranking_after.position}}
-- but ProdeCaballito sends: business_context.planilla_nombre and business_context.new_rank

UPDATE templates SET
  body = '😤 {{user.nombre}}, te superaron en {{business_context.planilla_nombre}}. Ahora estás #{{business_context.new_rank}}. ¡A reaccionar!',
  "updatedAt" = now()
WHERE name = 'sms_ranking_passed'
  AND (body LIKE '%{{user.planilla_nombre}}%' OR body LIKE '%ranking_after.position%');

-- Fix 2: Create sms_broadcast_manual and wa_broadcast_manual templates
-- These are missing — the rule has no templateId, causing random template selection.
-- ProdeCaballito sends payload.business_context.message for prode.broadcast_manual.

INSERT INTO templates (id, "tenantId", name, channel, subject, body, "aiInstructions", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  t.id,
  'sms_broadcast_manual',
  'sms',
  '',
  '📢 {{business_context.message}}',
  NULL,
  now(),
  now()
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM templates tpl WHERE tpl."tenantId" = t.id AND tpl.name = 'sms_broadcast_manual'
);

INSERT INTO templates (id, "tenantId", name, channel, subject, body, "aiInstructions", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  t.id,
  'wa_broadcast_manual',
  'whatsapp',
  '',
  '📢 {{business_context.message}}',
  NULL,
  now(),
  now()
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM templates tpl WHERE tpl."tenantId" = t.id AND tpl.name = 'wa_broadcast_manual'
);

-- Fix 3: Update broadcast_manual rule to link the new templates
-- Rule ID: cmpia7z16004y5o2t28uezsnh
-- Replaces actions with null templateId with the correct template references.

UPDATE rules SET
  actions = (
    SELECT jsonb_agg(
      CASE
        WHEN action->>'type' = 'SEND_NOTIFICATION' AND action->'params'->>'channel' = 'sms' THEN
          jsonb_set(action, '{params,templateId}', to_jsonb((
            SELECT id FROM templates WHERE "tenantId" = rules."tenantId" AND name = 'sms_broadcast_manual' LIMIT 1
          )))
        WHEN action->>'type' = 'SEND_NOTIFICATION' AND action->'params'->>'channel' = 'whatsapp' THEN
          jsonb_set(action, '{params,templateId}', to_jsonb((
            SELECT id FROM templates WHERE "tenantId" = rules."tenantId" AND name = 'wa_broadcast_manual' LIMIT 1
          )))
        ELSE action
      END
    )
    FROM jsonb_array_elements(rules.actions::jsonb) AS action
  ),
  "updatedAt" = now()
WHERE name = 'PC: broadcast_manual → Email + SMS + WhatsApp';
