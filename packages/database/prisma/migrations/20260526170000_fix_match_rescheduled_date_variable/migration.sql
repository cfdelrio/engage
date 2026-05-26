-- Fix match_rescheduled templates: nueva_fecha → match.new_datetime
-- Root cause: templates were written with {{business_context.nueva_fecha}} but
-- ProdeCaballito sends the date nested as business_context.match.new_datetime.

DO $$
DECLARE
  v_tenant_id text;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'prodecaballito';
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  UPDATE templates SET
    body = REPLACE(body, '{{business_context.nueva_fecha}}', '{{business_context.match.new_datetime}}'),
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id
    AND slug IN ('wa_match_rescheduled', 'sms_match_rescheduled', 'email_match_rescheduled')
    AND body LIKE '%{{business_context.nueva_fecha}}%';

  RAISE NOTICE 'Fixed nueva_fecha → match.new_datetime in match_rescheduled templates.';
END $$;
