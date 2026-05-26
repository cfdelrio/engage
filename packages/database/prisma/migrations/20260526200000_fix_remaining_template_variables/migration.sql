-- Fix remaining template variable mismatches found during full payload audit.
--
-- Cross-referenced every event payload in the official ProdeCaballito events doc
-- against the Handlebars variables in each template. Fixes variables that were
-- either wrong in prior migrations (email HTML templates) or were never fixed
-- (sms_tournament_tomorrow, sms_second_half, wa_payment_pending).
--
-- For HTML email bodies: REPLACE is used to preserve styling; full overwrite
-- would require duplicating large HTML blocks.

DO $$
DECLARE
  v_tenant_id text;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'prodecaballito';
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  -- ── SMS fixes ─────────────────────────────────────────────────────────────

  -- sms_tournament_tomorrow: user.tournament_name doesn't exist in user.metadata;
  -- Prode sends tournament_name in business_context.
  UPDATE templates SET
    body = '🏟️ ¡Mañana arranca {{business_context.tournament_name}}! ¿Ya tenés tus pronósticos, {{user.nombre}}?',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND name = 'sms_tournament_tomorrow';

  -- sms_second_half: template used match.goles_local / match.goles_visitante which
  -- don't exist in the payload. The payload has bet.goles_local (user's prediction).
  -- Simplified body avoids null-bet rendering issues.
  UPDATE templates SET
    body = '⚽ ¡Segundo tiempo! {{business_context.match.local}} vs {{business_context.match.away}}. Tu apuesta: {{business_context.bet.goles_local}}-{{business_context.bet.goles_visitante}} 🤞',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND name = 'sms_second_half';

  -- ── WhatsApp fixes ────────────────────────────────────────────────────────

  -- wa_payment_pending: user.planilla_nombre is not stored in user.metadata;
  -- Prode sends planilla_nombre in business_context for this event.
  UPDATE templates SET
    body = '💳 {{user.nombre}}, tu pago está pendiente. Para seguir jugando en {{business_context.planilla_nombre}} necesitás regularizar tu situación.',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND name = 'wa_payment_pending';

  -- ── Email HTML fixes (REPLACE to preserve HTML styling) ───────────────────

  -- email_result_individual: {{business_context.puntos}} → bet.puntos_obtenidos
  -- Migration 20260526120000 tried this fix but used non-existent slug column.
  UPDATE templates SET
    body = REPLACE(body, '{{business_context.puntos}}', '{{business_context.bet.puntos_obtenidos}}'),
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND name = 'email_result_individual'
    AND body LIKE '%{{business_context.puntos}}%';

  -- email_winner_broadcast: ganador → winner_name, puntos → points
  -- Migration 20260526120000 tried this fix but used non-existent slug column.
  UPDATE templates SET
    body = REPLACE(
      REPLACE(body, '{{business_context.ganador}}', '{{business_context.winner_name}}'),
      '{{business_context.puntos}}', '{{business_context.points}}'
    ),
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND name = 'email_winner_broadcast'
    AND (body LIKE '%{{business_context.ganador}}%' OR body LIKE '%{{business_context.puntos}}%');

  -- email_payment_pending: user.planilla_nombre → business_context.planilla_nombre
  UPDATE templates SET
    body = REPLACE(body, '{{user.planilla_nombre}}', '{{business_context.planilla_nombre}}'),
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND name = 'email_payment_pending'
    AND body LIKE '%{{user.planilla_nombre}}%';

  -- email_weekly_digest: user.ranking_position/puntos_totales/current_streak are
  -- not stored in user.metadata — Prode sends them in business_context.
  UPDATE templates SET
    body = REPLACE(
      REPLACE(
        REPLACE(
          body,
          '{{user.ranking_position}}', '{{business_context.ranking_position}}'
        ),
        '{{user.puntos_totales}}', '{{business_context.points}}'
      ),
      '{{user.current_streak}}', '{{business_context.best_round_points}}'
    ),
    subject = REPLACE(subject, '{{user.ranking_position}}', '{{business_context.ranking_position}}'),
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND name = 'email_weekly_digest';

  RAISE NOTICE 'Fixed remaining template variable mismatches (7 templates) for tenant prodecaballito.';
END $$;
