-- Direct fix for all broken template variables.
--
-- Previous migrations (20260526120000, 20260526170000, 20260526190000, 20260526200000)
-- used `WHERE slug = 'prodecaballito'` to find the tenant, but the production tenant
-- has a different slug — causing every UPDATE to match zero rows silently.
--
-- This migration uses `WHERE name = '...' AND body LIKE '%broken_var%'` with no
-- tenant lookup, so it works regardless of slug and is fully idempotent.

-- ── SMS ───────────────────────────────────────────────────────────────────────

UPDATE templates SET
  body = '⏰ ¡ÚLTIMO AVISO! El cierre de pronósticos para {{business_context.tournament_name}} es en {{business_context.minutes_left}} minutos.',
  "updatedAt" = now()
WHERE name = 'sms_cutoff_reminder'
  AND (body LIKE '%{{business_context.minutos}}%' OR body LIKE '%{{business_context.fecha_nombre}}%');

UPDATE templates SET
  body = '🏟️ ¡Mañana arranca {{business_context.tournament_name}}! ¿Ya tenés tus pronósticos, {{user.nombre}}?',
  "updatedAt" = now()
WHERE name = 'sms_tournament_tomorrow'
  AND body LIKE '%{{user.tournament_name}}%';

UPDATE templates SET
  body = '🏅 {{user.nombre}}, estás a {{business_context.gap}} pts del podio en {{business_context.planilla_nombre}}. ¡Dale que llegás!',
  "updatedAt" = now()
WHERE name = 'sms_near_podio'
  AND (body LIKE '%{{business_context.posiciones}}%' OR body LIKE '%{{user.planilla_nombre}}%');

UPDATE templates SET
  body = '🔥 {{user.nombre}}: {{business_context.streak}} exactos consecutivos! Estás en racha. 🔥',
  "updatedAt" = now()
WHERE name = 'sms_streak_exactos'
  AND body LIKE '%{{user.current_streak}}%';

UPDATE templates SET
  body = '🎯 {{user.nombre}} batiste tu récord! {{business_context.points}} pts en una fecha. ¡Crack!',
  "updatedAt" = now()
WHERE name = 'sms_personal_record'
  AND body LIKE '%{{business_context.puntos}}%';

UPDATE templates SET
  body = '📈 {{user.nombre}} subió al puesto #{{business_context.new_rank}} en {{business_context.planilla_nombre}} (+{{business_context.delta}} lugares). 🚀',
  "updatedAt" = now()
WHERE name = 'sms_ranking_up'
  AND (body LIKE '%{{business_context.ranking_after.position}}%' OR body LIKE '%{{user.planilla_nombre}}%');

UPDATE templates SET
  body = '🏅 {{user.nombre}} entró al top #{{business_context.new_rank}} en {{business_context.planilla_nombre}}! Seguí así. 🏆',
  "updatedAt" = now()
WHERE name = 'sms_ranking_entered'
  AND (body LIKE '%{{business_context.ranking_after.position}}%' OR body LIKE '%{{user.planilla_nombre}}%');

UPDATE templates SET
  body = '⚽ ¡Segundo tiempo! {{business_context.match.local}} vs {{business_context.match.away}}. Tu apuesta: {{business_context.bet.goles_local}}-{{business_context.bet.goles_visitante}} 🤞',
  "updatedAt" = now()
WHERE name = 'sms_second_half'
  AND body LIKE '%{{business_context.match.goles_local}}%';

UPDATE templates SET
  body = '⚽ {{user.nombre}}: faltan {{business_context.remind_minutes}} min para el cierre. ¡Cargá tus pronósticos!',
  "updatedAt" = now()
WHERE name = 'sms_bet_reminder'
  AND body LIKE '%{{business_context.horas}}%';

UPDATE templates SET
  body = '🏁 {{business_context.planilla_nombre}} cerró. {{user.nombre}} terminó #{{business_context.ranking_position}} con {{business_context.points}} pts. ¡Hasta la próxima!',
  "updatedAt" = now()
WHERE name = 'sms_planilla_cierre'
  AND (body LIKE '%{{user.planilla_nombre}}%' OR body LIKE '%{{business_context.ranking_after.position}}%' OR body LIKE '%{{business_context.puntos}}%');

UPDATE templates SET
  body = '📅 {{business_context.match.local}} vs {{business_context.match.away}} se reprogramó al {{business_context.match.new_datetime}}. Revisá tus pronósticos en ProdeCaballito.',
  "updatedAt" = now()
WHERE name = 'sms_match_rescheduled'
  AND body LIKE '%{{business_context.nueva_fecha}}%';

-- ── WhatsApp ──────────────────────────────────────────────────────────────────

UPDATE templates SET
  body = '⏰ ¡ÚLTIMO AVISO! El cierre de pronósticos para {{business_context.tournament_name}} es en {{business_context.minutes_left}} minutos.',
  "updatedAt" = now()
WHERE name = 'wa_cutoff_reminder'
  AND (body LIKE '%{{business_context.minutos}}%' OR body LIKE '%{{business_context.fecha_nombre}}%');

UPDATE templates SET
  body = '📅 El partido {{business_context.match.local}} vs {{business_context.match.away}} fue reprogramado para el {{business_context.match.new_datetime}}. Revisá tus pronósticos.',
  "updatedAt" = now()
WHERE name = 'wa_match_rescheduled'
  AND body LIKE '%{{business_context.nueva_fecha}}%';

UPDATE templates SET
  body = '🏅 {{user.nombre}}, estás a {{business_context.gap}} pts del podio en {{business_context.planilla_nombre}}. ¡Dale que llegás!',
  "updatedAt" = now()
WHERE name = 'wa_near_podio'
  AND (body LIKE '%{{business_context.posiciones}}%' OR body LIKE '%{{user.planilla_nombre}}%');

UPDATE templates SET
  body = '💳 {{user.nombre}}, tu pago está pendiente. Para seguir jugando en {{business_context.planilla_nombre}} necesitás regularizar tu situación.',
  "updatedAt" = now()
WHERE name = 'wa_payment_pending'
  AND body LIKE '%{{user.planilla_nombre}}%';

UPDATE templates SET
  body = '⚽ Hola {{user.nombre}}! Todavía no cargaste tus pronósticos para la fecha. Te quedan {{business_context.remind_minutes}} minutos. ¡Entrá ya!',
  "updatedAt" = now()
WHERE name = 'wa_bet_reminder'
  AND body LIKE '%{{business_context.horas}}%';

-- ── Email HTML (REPLACE to preserve surrounding HTML) ─────────────────────────

UPDATE templates SET
  body = REPLACE(body, '{{business_context.nueva_fecha}}', '{{business_context.match.new_datetime}}'),
  "updatedAt" = now()
WHERE name = 'email_match_rescheduled'
  AND body LIKE '%{{business_context.nueva_fecha}}%';

UPDATE templates SET
  body = REPLACE(body, '{{business_context.puntos}}', '{{business_context.bet.puntos_obtenidos}}'),
  "updatedAt" = now()
WHERE name = 'email_result_individual'
  AND body LIKE '%{{business_context.puntos}}%';

UPDATE templates SET
  body = REPLACE(
    REPLACE(body, '{{business_context.ganador}}', '{{business_context.winner_name}}'),
    '{{business_context.puntos}}', '{{business_context.points}}'
  ),
  "updatedAt" = now()
WHERE name = 'email_winner_broadcast'
  AND (body LIKE '%{{business_context.ganador}}%' OR body LIKE '%{{business_context.puntos}}%');

UPDATE templates SET
  body = REPLACE(body, '{{user.planilla_nombre}}', '{{business_context.planilla_nombre}}'),
  "updatedAt" = now()
WHERE name = 'email_payment_pending'
  AND body LIKE '%{{user.planilla_nombre}}%';

UPDATE templates SET
  body = REPLACE(
    REPLACE(
      REPLACE(body,
        '{{user.ranking_position}}', '{{business_context.ranking_position}}'),
      '{{user.puntos_totales}}', '{{business_context.points}}'),
    '{{user.current_streak}}', '{{business_context.best_round_points}}'
  ),
  subject = REPLACE(subject, '{{user.ranking_position}}', '{{business_context.ranking_position}}'),
  "updatedAt" = now()
WHERE name = 'email_weekly_digest'
  AND (
    body LIKE '%{{user.ranking_position}}%'
    OR body LIKE '%{{user.puntos_totales}}%'
    OR body LIKE '%{{user.current_streak}}%'
  );
