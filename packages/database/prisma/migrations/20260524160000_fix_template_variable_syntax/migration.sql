-- Fix Handlebars variable syntax in ProdeCaballito templates.
-- Templates were using unprefixed variables ({{nombre}}, {{puntos}}, etc.)
-- that resolve to nothing. The renderer exposes two scopes:
--   user.*             → user DB record + user.metadata fields
--   business_context.* → event payload business_context object
--
-- This migration updates body and subject of every affected template.
-- Safe to run on any environment; no-ops if tenant/template doesn't exist.

DO $$
DECLARE
  v_tenant_id TEXT;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'prodecaballito';
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  -- ── WhatsApp templates ────────────────────────────────────────────────────

  UPDATE templates SET
    body = '¡Hay un nuevo líder en {{user.planilla_nombre}}! {{user.nombre}} trepó al primer puesto. ¿Podés alcanzarlo?'
  WHERE "tenantId" = v_tenant_id AND name = 'wa_nuevo_lider';

  UPDATE templates SET
    body = 'Resultado {{business_context.match.local}} {{business_context.match.goles_local}}-{{business_context.match.goles_visitante}} {{business_context.match.away}}. Vos pronosticaste {{business_context.bet.goles_local}}-{{business_context.bet.goles_visitante}} y sumaste {{business_context.puntos}} pts.'
  WHERE "tenantId" = v_tenant_id AND name = 'wa_resultado_partido';

  UPDATE templates SET
    body = '¡{{user.nombre}} ganó la fecha en {{user.planilla_nombre}}! Felicitaciones al campeón. 🏆'
  WHERE "tenantId" = v_tenant_id AND name = 'wa_ganador_fecha';

  UPDATE templates SET
    body = '⚽ Hola {{user.nombre}}! Todavía no cargaste tus pronósticos para la fecha. Te quedan {{business_context.horas}} horas. Entrá ya!'
  WHERE "tenantId" = v_tenant_id AND name = 'wa_bet_reminder';

  UPDATE templates SET
    body = '💳 {{user.nombre}}, tu pago está pendiente. Para seguir jugando en {{user.planilla_nombre}} necesitás regularizar tu situación.'
  WHERE "tenantId" = v_tenant_id AND name = 'wa_payment_pending';

  UPDATE templates SET
    body = '¡Bienvenido a ProdeCaballito, {{user.nombre}}! 🎉 Ya sos parte de {{user.planilla_nombre}}. ¡A predecir!'
  WHERE "tenantId" = v_tenant_id AND name = 'wa_welcome';

  UPDATE templates SET
    body = '🏅 {{user.nombre}}, estás a solo {{business_context.posiciones}} lugar(es) del podio en {{user.planilla_nombre}}. ¡Dale que llegás!'
  WHERE "tenantId" = v_tenant_id AND name = 'wa_near_podio';

  UPDATE templates SET
    body = '📅 El partido {{business_context.match.local}} vs {{business_context.match.away}} fue reprogramado para el {{business_context.nueva_fecha}}. Revisá tus pronósticos.'
  WHERE "tenantId" = v_tenant_id AND name = 'wa_match_rescheduled';

  UPDATE templates SET
    body = '⏰ ¡ÚLTIMO AVISO! El cierre de pronósticos para {{business_context.fecha_nombre}} es en {{business_context.minutos}} minutos.'
  WHERE "tenantId" = v_tenant_id AND name = 'wa_cutoff_reminder';

  -- ── Email templates ───────────────────────────────────────────────────────

  UPDATE templates SET
    body = 'Hola {{user.nombre}},' || E'\n\n' || 'Tu código de verificación es: **{{business_context.code}}**' || E'\n\n' || 'Vence en 10 minutos.'
  WHERE "tenantId" = v_tenant_id AND name = 'email_verification_code';

  UPDATE templates SET
    subject = '¡Bienvenido a ProdeCaballito, {{user.nombre}}!',
    body    = 'Hola {{user.nombre}},' || E'\n\n' || 'Ya estás registrado en {{user.planilla_nombre}}. ¡A pronosticar!'
  WHERE "tenantId" = v_tenant_id AND name = 'email_welcome';

  UPDATE templates SET
    subject = 'Resultado: {{business_context.match.local}} {{business_context.match.goles_local}}-{{business_context.match.goles_visitante}} {{business_context.match.away}}',
    body    = 'Hola {{user.nombre}},' || E'\n\n' ||
              'Resultado: {{business_context.match.local}} {{business_context.match.goles_local}}-{{business_context.match.goles_visitante}} {{business_context.match.away}}' || E'\n\n' ||
              'Tu pronóstico: {{business_context.bet.goles_local}}-{{business_context.bet.goles_visitante}}' || E'\n' ||
              'Puntos obtenidos: {{business_context.puntos}}' || E'\n' ||
              'Ranking actual: #{{business_context.ranking_after.position}} en {{user.planilla_nombre}}'
  WHERE "tenantId" = v_tenant_id AND name = 'email_result_individual';

  UPDATE templates SET
    subject = 'Resultados de la fecha — {{user.planilla_nombre}}',
    body    = 'Hola {{user.nombre}},' || E'\n\n' || 'Ya están los resultados de la fecha en {{user.planilla_nombre}}. Entrá a ver tu posición.'
  WHERE "tenantId" = v_tenant_id AND name = 'email_result_broadcast';

  UPDATE templates SET
    body = 'Hola {{user.nombre}},' || E'\n\n' || 'Tenés un pago pendiente para continuar participando en {{user.planilla_nombre}}. Regularizá tu situación para no perder tu posición.'
  WHERE "tenantId" = v_tenant_id AND name = 'email_payment_pending';

  UPDATE templates SET
    subject = '🏆 ¡Ganaste la fecha en {{user.planilla_nombre}}!',
    body    = 'Hola {{user.nombre}},' || E'\n\n' || '¡Felicitaciones! Ganaste la fecha con {{business_context.puntos}} puntos en {{user.planilla_nombre}}. ¡Sos el mejor!'
  WHERE "tenantId" = v_tenant_id AND name = 'email_winner_personal';

  UPDATE templates SET
    subject = '🏆 Hay un ganador en {{user.planilla_nombre}}',
    body    = 'Hola {{user.nombre}},' || E'\n\n' || '{{business_context.ganador}} ganó la fecha en {{user.planilla_nombre}} con {{business_context.puntos}} puntos. ¿Podés superarlo la próxima?'
  WHERE "tenantId" = v_tenant_id AND name = 'email_winner_broadcast';

  UPDATE templates SET
    subject = 'Resumen de fecha — {{user.planilla_nombre}}',
    body    = 'Hola {{user.nombre}},' || E'\n\n' ||
              'Acá está tu resumen de la fecha:' || E'\n' ||
              '- Puntos: {{business_context.puntos}}' || E'\n' ||
              '- Posición: #{{business_context.ranking_after.position}}' || E'\n' ||
              '- Exactos: {{business_context.exactos}}' || E'\n\n' ||
              'Seguí así!'
  WHERE "tenantId" = v_tenant_id AND name = 'email_matchday_summary';

  UPDATE templates SET
    body = 'Hola {{user.nombre}},' || E'\n\n' ||
           'Esta semana en {{user.planilla_nombre}}:' || E'\n' ||
           '- Posición: #{{user.ranking_position}}' || E'\n' ||
           '- Puntos acumulados: {{user.puntos_totales}}' || E'\n' ||
           '- Racha exactos: {{user.current_streak}}' || E'\n\n' ||
           '¡Seguí pronosticando!'
  WHERE "tenantId" = v_tenant_id AND name = 'email_weekly_digest';

  UPDATE templates SET
    body = 'Hola {{user.nombre}},' || E'\n\n' || 'Todavía no cargaste tus pronósticos para la próxima fecha en {{user.planilla_nombre}}. El cierre es pronto.'
  WHERE "tenantId" = v_tenant_id AND name = 'email_bet_reminder';

  UPDATE templates SET
    subject = '📅 Cambio de fecha: {{business_context.match.local}} vs {{business_context.match.away}}',
    body    = 'Hola {{user.nombre}},' || E'\n\n' || 'El partido {{business_context.match.local}} vs {{business_context.match.away}} fue reprogramado para el {{business_context.nueva_fecha}}. Revisá tus pronósticos si es necesario.'
  WHERE "tenantId" = v_tenant_id AND name = 'email_match_rescheduled';

  UPDATE templates SET
    body = 'Hola {{user.nombre}},' || E'\n\n' || 'Mañana arranca la acción en {{user.planilla_nombre}}. ¿Ya tenés listos tus pronósticos?'
  WHERE "tenantId" = v_tenant_id AND name = 'email_tournament_tomorrow';

  UPDATE templates SET
    subject = 'Planilla cerrada — Resultados finales de {{user.planilla_nombre}}',
    body    = 'Hola {{user.nombre}},' || E'\n\n' || 'La planilla {{user.planilla_nombre}} cerró. Tu posición final fue #{{business_context.ranking_after.position}} con {{business_context.puntos}} puntos totales. ¡Hasta la próxima!'
  WHERE "tenantId" = v_tenant_id AND name = 'email_planilla_cierre';

  -- ── SMS templates ─────────────────────────────────────────────────────────

  UPDATE templates SET
    body = 'ProdeCaballito: Tu código es {{business_context.code}}. Vence en 10 min.'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_verification_code';

  UPDATE templates SET
    body = '⚽ {{user.nombre}}: faltan {{business_context.horas}}hs para el cierre. ¡Cargá tus pronósticos en ProdeCaballito!'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_bet_reminder';

  UPDATE templates SET
    body = '⏰ URGENTE {{user.nombre}}: el cierre es en {{business_context.minutos}} minutos. ¡Ya!'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_cutoff_reminder';

  UPDATE templates SET
    body = '🟢 Arranca {{business_context.match.local}} vs {{business_context.match.away}}! Suerte {{user.nombre}} 🤞'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_kickoff';

  UPDATE templates SET
    body = '⚽ Segundo tiempo: {{business_context.match.local}} {{business_context.match.goles_local}}-{{business_context.match.goles_visitante}} {{business_context.match.away}}'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_second_half';

  UPDATE templates SET
    body = '🏅 {{user.nombre}} entró al top {{business_context.ranking_after.position}} en {{user.planilla_nombre}}! Seguí así.'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_ranking_entered';

  UPDATE templates SET
    body = '📈 {{user.nombre}} subió al puesto #{{business_context.ranking_after.position}} en {{user.planilla_nombre}} (+{{business_context.ranking_after.delta}} lugares).'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_ranking_up';

  UPDATE templates SET
    body = '😤 {{user.nombre}}, te superaron en {{user.planilla_nombre}}. Ahora estás #{{business_context.ranking_after.position}}. ¡A reaccionar!'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_ranking_passed';

  UPDATE templates SET
    body = '🎯 {{user.nombre}} batiste tu récord! {{business_context.puntos}} pts en una fecha. ¡Crack!'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_personal_record';

  UPDATE templates SET
    body = '🔥 {{user.nombre}}: {{user.current_streak}} exactos consecutivos! Estás en racha.'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_streak_exactos';

  UPDATE templates SET
    body = '💳 {{user.nombre}}: tenés un pago pendiente en ProdeCaballito. Regularizá para seguir jugando.'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_payment_pending';

  UPDATE templates SET
    body = '🏅 {{user.nombre}}, ¡estás a {{business_context.posiciones}} del podio en {{user.planilla_nombre}}! Dale.'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_near_podio';

  UPDATE templates SET
    body = '🏟️ ¡Mañana arranca {{user.tournament_name}}! ¿Ya tenés tus pronósticos, {{user.nombre}}?'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_tournament_tomorrow';

  UPDATE templates SET
    body = '📅 {{business_context.match.local}} vs {{business_context.match.away}} se reprogramó al {{business_context.nueva_fecha}}. ProdeCaballito.'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_match_rescheduled';

  UPDATE templates SET
    body = '🏁 {{user.planilla_nombre}} cerró. {{user.nombre}} terminó #{{business_context.ranking_after.position}} con {{business_context.puntos}}pts. ¡Hasta la próxima!'
  WHERE "tenantId" = v_tenant_id AND name = 'sms_planilla_cierre';

END $$;
