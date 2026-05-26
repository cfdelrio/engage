-- Fix Handlebars variable names in ProdeCaballito templates.
-- Aligns template variables with actual field names sent by ProdeCaballito BE.
--
-- Root cause: templates were written with assumed field names that don't match
-- what ProdeCaballito actually sends in business_context.
-- Source of truth for field names: prode-caballito-be/services/ and routes/.

DO $$
DECLARE
  v_tenant_id text;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'prodecaballito';
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  -- ── SMS templates ────────────────────────────────────────────────────────────

  -- sms_bet_reminder: Prode sends remind_minutes (number), not horas
  UPDATE templates SET
    body = '⚽ {{user.nombre}}: faltan {{business_context.remind_minutes}} min para el cierre. ¡Cargá tus pronósticos en ProdeCaballito!',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND slug = 'sms_bet_reminder';

  -- sms_cutoff_reminder: Prode sends minutes_left (not minutos)
  UPDATE templates SET
    body = '⏰ URGENTE {{user.nombre}}: el cierre es en {{business_context.minutes_left}} minutos. ¡Ya!',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND slug = 'sms_cutoff_reminder';

  -- sms_ranking_entered: Prode sends {new_rank, delta, planilla_nombre} flat (not ranking_after.*)
  UPDATE templates SET
    body = '🏅 {{user.nombre}} entró al puesto #{{business_context.new_rank}} en {{business_context.planilla_nombre}}! Seguí así.',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND slug = 'sms_ranking_entered';

  -- sms_ranking_up: same as above + delta is flat
  UPDATE templates SET
    body = '📈 {{user.nombre}} subió al puesto #{{business_context.new_rank}} en {{business_context.planilla_nombre}} (+{{business_context.delta}} lugares).',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND slug = 'sms_ranking_up';

  -- sms_personal_record: Prode sends points (not puntos)
  UPDATE templates SET
    body = '🎯 {{user.nombre}} batiste tu récord! {{business_context.points}} pts en una fecha. ¡Crack!',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND slug = 'sms_personal_record';

  -- sms_streak_exactos: Prode sends business_context.streak (not user.current_streak)
  UPDATE templates SET
    body = '🔥 {{user.nombre}}: {{business_context.streak}} exactos consecutivos! Estás en racha.',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND slug = 'sms_streak_exactos';

  -- sms_near_podio: Prode sends gap (points gap, not posiciones) and planilla_nombre in business_context
  UPDATE templates SET
    body = '🏅 {{user.nombre}}, ¡estás a {{business_context.gap}} puntos del podio en {{business_context.planilla_nombre}}! Dale.',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND slug = 'sms_near_podio';

  -- sms_planilla_cierre: Prode sends {planilla_nombre, torneo_name, matches[]}
  -- ranking_after.position and puntos do NOT exist in this event's payload
  UPDATE templates SET
    body = '🏁 {{business_context.planilla_nombre}} cerró en {{business_context.torneo_name}}. ¡Gracias por jugar, {{user.nombre}}!',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND slug = 'sms_planilla_cierre';

  -- ── WhatsApp templates ───────────────────────────────────────────────────────

  -- wa_bet_reminder: Prode sends remind_minutes (not horas)
  UPDATE templates SET
    body = '⚽ Hola {{user.nombre}}! Todavía no cargaste tus pronósticos para la fecha. Te quedan {{business_context.remind_minutes}} minutos. Entrá ya!',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND slug = 'wa_bet_reminder';

  -- wa_cutoff_reminder: Prode sends tournament_name (not fecha_nombre) and minutes_left (not minutos)
  UPDATE templates SET
    body = '⏰ ¡ÚLTIMO AVISO! El cierre de pronósticos para {{business_context.tournament_name}} es en {{business_context.minutes_left}} minutos.',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND slug = 'wa_cutoff_reminder';

  -- wa_near_podio: Prode sends gap (points) and planilla_nombre in business_context
  UPDATE templates SET
    body = '🏅 {{user.nombre}}, estás a {{business_context.gap}} puntos del podio en {{business_context.planilla_nombre}}. ¡Dale que llegás!',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND slug = 'wa_near_podio';

  -- wa_resultado_partido: Prode sends bet.puntos_obtenidos (not a top-level puntos)
  UPDATE templates SET
    body = 'Resultado {{business_context.match.local}} {{business_context.match.goles_local}}-{{business_context.match.goles_visitante}} {{business_context.match.away}}. Vos pronosticaste {{business_context.bet.goles_local}}-{{business_context.bet.goles_visitante}} y sumaste {{business_context.bet.puntos_obtenidos}} pts.',
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND slug = 'wa_resultado_partido';

  -- ── Email templates (HTML body — use REPLACE to preserve styling) ────────────

  -- email_result_individual: puntos → bet.puntos_obtenidos
  -- (ranking_after.position is already correct — Prode sends ranking_after: { position })
  UPDATE templates SET
    body = REPLACE(body, '{{business_context.puntos}}', '{{business_context.bet.puntos_obtenidos}}'),
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND slug = 'email_result_individual';

  -- email_winner_broadcast: ganador → winner_name, puntos → points
  -- (Prode sends winner_name and points, not ganador/puntos)
  UPDATE templates SET
    body = REPLACE(
      REPLACE(body, '{{business_context.ganador}}', '{{business_context.winner_name}}'),
      '{{business_context.puntos}}', '{{business_context.points}}'
    ),
    "updatedAt" = now()
  WHERE "tenantId" = v_tenant_id AND slug = 'email_winner_broadcast';

  RAISE NOTICE 'Template variable fixes applied (14 templates) for tenant prodecaballito.';
END $$;
