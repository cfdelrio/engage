-- Fix verification code templates: change {{business_context.code}} → {{code}}
-- The event payload sends code at the root of payload, not nested in business_context.
-- Handlebars silently renders missing paths as empty string, so the code field was blank.

UPDATE templates
SET body = replace(body, '{{business_context.code}}', '{{code}}')
WHERE name IN ('email_verification_code', 'sms_verification_code')
  AND "tenantId" = (SELECT id FROM tenants WHERE slug = 'prodecaballito');
