-- Data migration: replace plain-text email templates with styled HTML
-- and fix variable-name mismatches between ProdeCaballito payloads and templates.
--
-- Key fix: email_matchday_summary used {{business_context.puntos}} and
-- {{business_context.ranking_after.position}} but the actual payload from
-- routes/matchdays.js uses {{business_context.points}} and
-- {{business_context.rank_in_matchday}}.
--
-- All templates use Handlebars syntax: {{variable.path}}
-- Context structure: { user: { nombre, email, ... }, business_context: { ... } }
-- user.* comes from user.metadata (spread) + user row fields.

DO $$
DECLARE
  v_tenant_id TEXT;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'prodecaballito';
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'Tenant prodecaballito not found – skipping email template migration.';
    RETURN;
  END IF;

  -- ────────────────────────────────────────────────────────────────────────────
  -- email_matchday_summary — CRITICAL FIX
  -- Payload fields: points, rank_in_matchday, global_position, matchday_name,
  --                 top_name, top_points, total_planillas, is_winner
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE templates SET
    subject = 'Resumen de fecha — {{business_context.matchday_name}}',
    body = $T1$<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;">

  <!-- Header -->
  <tr><td style="padding:28px 32px 0;text-align:center;">
    <div style="font-size:28px;font-weight:900;color:#F59E0B;letter-spacing:-1px;">PRODE Caballito</div>
    <div style="font-size:13px;color:#6b7280;margin-top:4px;">{{business_context.matchday_name}}</div>
  </td></tr>

  <!-- Title -->
  <tr><td style="padding:20px 32px 0;text-align:center;">
    <div style="font-size:20px;font-weight:700;color:#ffffff;">Tu resumen de la fecha ⚽</div>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:12px 32px 0;">
    <p style="margin:0;font-size:15px;color:#d1d5db;">Hola <strong style="color:#ffffff;">{{user.nombre}}</strong>,</p>
    <p style="margin:8px 0 0;font-size:15px;color:#d1d5db;">Ya cerró la fecha. Acá están tus números:</p>
  </td></tr>

  <!-- Stats cards -->
  <tr><td style="padding:20px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="33%" style="padding:0 6px 0 0;text-align:center;">
          <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px 8px;">
            <div style="font-size:28px;font-weight:900;color:#F59E0B;">{{business_context.points}}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;">Puntos</div>
          </div>
        </td>
        <td width="34%" style="padding:0 3px;text-align:center;">
          <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px 8px;">
            <div style="font-size:28px;font-weight:900;color:#ffffff;">#{{business_context.rank_in_matchday}}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;">En esta fecha</div>
          </div>
        </td>
        <td width="33%" style="padding:0 0 0 6px;text-align:center;">
          <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px 8px;">
            <div style="font-size:28px;font-weight:900;color:#ffffff;">#{{business_context.global_position}}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;">Global</div>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Top performer -->
  <tr><td style="padding:0 32px 8px;">
    <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:14px 16px;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Ganador de la fecha</div>
      <div style="font-size:15px;font-weight:700;color:#F59E0B;">🏆 {{business_context.top_name}}</div>
      <div style="font-size:13px;color:#9ca3af;margin-top:2px;">{{business_context.top_points}} puntos</div>
    </div>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:20px 32px;">
    <div style="text-align:center;">
      <a href="https://prodecaballito.com" style="display:inline-block;background:#F59E0B;color:#000;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;">Ver mi ranking completo →</a>
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #2a2a2a;">
    <div style="font-size:12px;color:#4b5563;">ProdeCaballito · {{user.planilla_nombre}}</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>$T1$,
    "updatedAt" = now()
  WHERE name = 'email_matchday_summary' AND "tenantId" = v_tenant_id;

  -- ────────────────────────────────────────────────────────────────────────────
  -- email_result_individual
  -- Payload: match.{local,away,goles_local,goles_visitante}, bet.{goles_local,goles_visitante},
  --          puntos, outcome, ranking_after.{position,total,delta}
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE templates SET
    subject = '⚽ {{business_context.match.local}} {{business_context.match.goles_local}}-{{business_context.match.goles_visitante}} {{business_context.match.away}} — tu resultado',
    body = $T2$<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;">

  <tr><td style="padding:28px 32px 0;text-align:center;">
    <div style="font-size:28px;font-weight:900;color:#F59E0B;letter-spacing:-1px;">PRODE Caballito</div>
  </td></tr>

  <!-- Match result -->
  <tr><td style="padding:24px 32px 0;">
    <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:20px;text-align:center;">
      <div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Resultado final</div>
      <div style="font-size:18px;font-weight:700;color:#ffffff;">
        {{business_context.match.local}}
        <span style="color:#F59E0B;margin:0 12px;font-size:22px;">{{business_context.match.goles_local}} - {{business_context.match.goles_visitante}}</span>
        {{business_context.match.away}}
      </div>
    </div>
  </td></tr>

  <!-- Your bet -->
  <tr><td style="padding:16px 32px 0;">
    <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:20px;">
      <div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Tu pronóstico</div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:18px;font-weight:700;color:#ffffff;">{{business_context.bet.goles_local}} - {{business_context.bet.goles_visitante}}</div>
        <div style="font-size:26px;font-weight:900;color:#F59E0B;">+{{business_context.puntos}} pts</div>
      </div>
    </div>
  </td></tr>

  <!-- Ranking -->
  <tr><td style="padding:16px 32px 0;">
    <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px;text-align:center;">
      <div style="font-size:13px;color:#6b7280;margin-bottom:4px;">Tu posición actual</div>
      <div style="font-size:24px;font-weight:900;color:#ffffff;">#{{business_context.ranking_after.position}}</div>
    </div>
  </td></tr>

  <tr><td style="padding:20px 32px;">
    <div style="text-align:center;">
      <a href="https://prodecaballito.com" style="display:inline-block;background:#F59E0B;color:#000;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;">Ver ranking completo →</a>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #2a2a2a;">
    <div style="font-size:12px;color:#4b5563;">ProdeCaballito · {{user.planilla_nombre}}</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>$T2$,
    "updatedAt" = now()
  WHERE name = 'email_result_individual' AND "tenantId" = v_tenant_id;

  -- ────────────────────────────────────────────────────────────────────────────
  -- email_welcome
  -- Payload: user.nombre (from metadata)
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE templates SET
    subject = '🔥 ¡{{user.nombre}}, bienvenido al PRODE Caballito!',
    body = $T3$<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;">

  <tr><td style="padding:40px 32px 24px;text-align:center;background:linear-gradient(135deg,#1a1a1a 0%,#0f0f0f 100%);">
    <div style="font-size:40px;font-weight:900;color:#F59E0B;letter-spacing:-2px;">PRODE<br>Caballito</div>
    <div style="font-size:14px;color:#6b7280;margin-top:8px;">Mundial 2026</div>
  </td></tr>

  <tr><td style="padding:32px;text-align:center;">
    <div style="font-size:22px;font-weight:700;color:#ffffff;margin-bottom:12px;">¡Ya sos parte del equipo, {{user.nombre}}! 🎉</div>
    <p style="margin:0;font-size:15px;color:#d1d5db;line-height:1.6;">
      Ya estás registrado en <strong style="color:#F59E0B;">{{user.planilla_nombre}}</strong>.<br>
      Empezá a cargar tus pronósticos y subí al ranking.
    </p>
  </td></tr>

  <!-- Steps -->
  <tr><td style="padding:0 32px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:10px;background:#111;border:1px solid #2a2a2a;border-radius:12px;text-align:center;">
          <div style="font-size:20px;">📋</div>
          <div style="font-size:12px;color:#F59E0B;font-weight:700;margin-top:4px;">Elegí tus pronósticos</div>
        </td>
        <td width="12"></td>
        <td style="padding:10px;background:#111;border:1px solid #2a2a2a;border-radius:12px;text-align:center;">
          <div style="font-size:20px;">⚽</div>
          <div style="font-size:12px;color:#F59E0B;font-weight:700;margin-top:4px;">Acumulá puntos</div>
        </td>
        <td width="12"></td>
        <td style="padding:10px;background:#111;border:1px solid #2a2a2a;border-radius:12px;text-align:center;">
          <div style="font-size:20px;">🏆</div>
          <div style="font-size:12px;color:#F59E0B;font-weight:700;margin-top:4px;">Ganá la fecha</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 32px;">
    <div style="text-align:center;">
      <a href="https://prodecaballito.com" style="display:inline-block;background:#F59E0B;color:#000;font-weight:700;font-size:16px;padding:14px 32px;border-radius:8px;text-decoration:none;">EMPEZAR A JUGAR →</a>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #2a2a2a;">
    <div style="font-size:12px;color:#4b5563;">ProdeCaballito · {{user.planilla_nombre}}</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>$T3$,
    "updatedAt" = now()
  WHERE name = 'email_welcome' AND "tenantId" = v_tenant_id;

  -- ────────────────────────────────────────────────────────────────────────────
  -- email_bet_reminder
  -- Payload: business_context.{pending_count, first_match, minutes_left}
  --          OR business_context.{match.{local,away}, minutes_left}
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE templates SET
    subject = '⏰ {{user.nombre}}, el cierre es en {{business_context.minutes_left}} minutos',
    body = $T4$<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;">

  <tr><td style="padding:28px 32px 0;text-align:center;">
    <div style="font-size:28px;font-weight:900;color:#F59E0B;letter-spacing:-1px;">PRODE Caballito</div>
  </td></tr>

  <!-- Urgency banner -->
  <tr><td style="padding:20px 32px 0;">
    <div style="background:#451a03;border:1px solid #92400e;border-radius:12px;padding:16px;text-align:center;">
      <div style="font-size:32px;font-weight:900;color:#F59E0B;">⏰ {{business_context.minutes_left}} min</div>
      <div style="font-size:13px;color:#fcd34d;margin-top:4px;font-weight:600;">para el cierre de pronósticos</div>
    </div>
  </td></tr>

  <tr><td style="padding:20px 32px 0;">
    <p style="margin:0;font-size:15px;color:#d1d5db;">
      Hola <strong style="color:#ffffff;">{{user.nombre}}</strong>, todavía tenés
      <strong style="color:#F59E0B;">{{business_context.pending_count}} pronóstico(s)</strong> pendiente(s).
    </p>
    <p style="margin:10px 0 0;font-size:14px;color:#9ca3af;">
      Primero que arranca: <strong style="color:#ffffff;">{{business_context.first_match}}</strong>
    </p>
  </td></tr>

  <tr><td style="padding:20px 32px;">
    <div style="text-align:center;">
      <a href="https://prodecaballito.com" style="display:inline-block;background:#F59E0B;color:#000;font-weight:700;font-size:16px;padding:14px 32px;border-radius:8px;text-decoration:none;">Cargar pronósticos ahora →</a>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #2a2a2a;">
    <div style="font-size:12px;color:#4b5563;">ProdeCaballito · {{user.planilla_nombre}}</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>$T4$,
    "updatedAt" = now()
  WHERE name = 'email_bet_reminder' AND "tenantId" = v_tenant_id;

  -- ────────────────────────────────────────────────────────────────────────────
  -- email_payment_pending
  -- Payload: user.nombre, user.planilla_nombre
  --          business_context.{planilla_nombre, torneo_name, total_due}
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE templates SET
    subject = '💸 {{user.nombre}}, tu planilla todavía no está paga',
    body = $T5$<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;">

  <tr><td style="padding:28px 32px 0;text-align:center;">
    <div style="font-size:28px;font-weight:900;color:#F59E0B;letter-spacing:-1px;">PRODE Caballito</div>
  </td></tr>

  <tr><td style="padding:20px 32px 0;">
    <div style="background:#3b0764;border:1px solid #6d28d9;border-radius:12px;padding:20px;text-align:center;">
      <div style="font-size:28px;margin-bottom:8px;">💸</div>
      <div style="font-size:16px;font-weight:700;color:#ffffff;">Pago pendiente</div>
      <div style="font-size:13px;color:#c4b5fd;margin-top:4px;">{{user.planilla_nombre}}</div>
    </div>
  </td></tr>

  <tr><td style="padding:20px 32px 0;">
    <p style="margin:0;font-size:15px;color:#d1d5db;">
      Hola <strong style="color:#ffffff;">{{user.nombre}}</strong>,
    </p>
    <p style="margin:10px 0 0;font-size:15px;color:#d1d5db;">
      Tu participación en <strong style="color:#F59E0B;">{{business_context.torneo_name}}</strong>
      tiene un pago pendiente. Regularizá tu situación para no perder tu posición en el ranking.
    </p>
  </td></tr>

  <tr><td style="padding:20px 32px;">
    <div style="text-align:center;">
      <a href="https://prodecaballito.com" style="display:inline-block;background:#F59E0B;color:#000;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;">Confirmar pago →</a>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #2a2a2a;">
    <div style="font-size:12px;color:#4b5563;">ProdeCaballito · {{user.planilla_nombre}}</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>$T5$,
    "updatedAt" = now()
  WHERE name = 'email_payment_pending' AND "tenantId" = v_tenant_id;

  -- ────────────────────────────────────────────────────────────────────────────
  -- email_winner_personal
  -- Payload: business_context.{points, matchday_name}
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE templates SET
    subject = '🏆 ¡{{user.nombre}}, ganaste la fecha!',
    body = $T6$<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;">

  <tr><td style="padding:40px 32px 24px;text-align:center;">
    <div style="font-size:56px;margin-bottom:12px;">🏆</div>
    <div style="font-size:28px;font-weight:900;color:#F59E0B;letter-spacing:-1px;">¡GANASTE!</div>
    <div style="font-size:15px;color:#d1d5db;margin-top:8px;">
      <strong style="color:#ffffff;">{{user.nombre}}</strong> ganó
      <strong style="color:#F59E0B;">{{business_context.matchday_name}}</strong>
    </div>
  </td></tr>

  <tr><td style="padding:0 32px 20px;">
    <div style="background:#111;border:2px solid #F59E0B;border-radius:12px;padding:24px;text-align:center;">
      <div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Tus puntos</div>
      <div style="font-size:48px;font-weight:900;color:#F59E0B;line-height:1;">{{business_context.points}}</div>
    </div>
  </td></tr>

  <tr><td style="padding:0 32px 20px;">
    <div style="text-align:center;">
      <a href="https://prodecaballito.com" style="display:inline-block;background:#F59E0B;color:#000;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;">Ver el ranking →</a>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #2a2a2a;">
    <div style="font-size:12px;color:#4b5563;">ProdeCaballito · {{user.planilla_nombre}}</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>$T6$,
    "updatedAt" = now()
  WHERE name = 'email_winner_personal' AND "tenantId" = v_tenant_id;

  -- ────────────────────────────────────────────────────────────────────────────
  -- email_winner_broadcast
  -- Payload: business_context.{ganador, puntos, matchday_name}
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE templates SET
    subject = '🏆 Hay un ganador en {{user.planilla_nombre}}',
    body = $T7$<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;">

  <tr><td style="padding:28px 32px 0;text-align:center;">
    <div style="font-size:28px;font-weight:900;color:#F59E0B;letter-spacing:-1px;">PRODE Caballito</div>
  </td></tr>

  <tr><td style="padding:20px 32px 0;text-align:center;">
    <div style="font-size:36px;">🏆</div>
    <div style="font-size:20px;font-weight:700;color:#ffffff;margin-top:8px;">Ganador de {{business_context.matchday_name}}</div>
  </td></tr>

  <tr><td style="padding:16px 32px 0;">
    <div style="background:#111;border:2px solid #F59E0B;border-radius:12px;padding:20px;text-align:center;">
      <div style="font-size:22px;font-weight:900;color:#F59E0B;">{{business_context.ganador}}</div>
      <div style="font-size:15px;color:#d1d5db;margin-top:4px;">{{business_context.puntos}} puntos</div>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 8px;">
    <p style="margin:0;font-size:14px;color:#9ca3af;text-align:center;">
      Hola {{user.nombre}}, ¿podés superarlo la próxima fecha?
    </p>
  </td></tr>

  <tr><td style="padding:16px 32px 20px;">
    <div style="text-align:center;">
      <a href="https://prodecaballito.com" style="display:inline-block;background:#F59E0B;color:#000;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;">Ver ranking →</a>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #2a2a2a;">
    <div style="font-size:12px;color:#4b5563;">ProdeCaballito · {{user.planilla_nombre}}</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>$T7$,
    "updatedAt" = now()
  WHERE name = 'email_winner_broadcast' AND "tenantId" = v_tenant_id;

  -- ────────────────────────────────────────────────────────────────────────────
  -- email_weekly_digest
  -- Payload: user.{ranking_position, puntos_totales, current_streak, planilla_nombre}
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE templates SET
    subject = '📊 Tu semana en ProdeCaballito, {{user.nombre}}',
    body = $T8$<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;">

  <tr><td style="padding:28px 32px 0;text-align:center;">
    <div style="font-size:28px;font-weight:900;color:#F59E0B;letter-spacing:-1px;">PRODE Caballito</div>
    <div style="font-size:13px;color:#6b7280;margin-top:4px;">Resumen semanal</div>
  </td></tr>

  <tr><td style="padding:20px 32px 0;">
    <p style="margin:0;font-size:15px;color:#d1d5db;">
      Hola <strong style="color:#ffffff;">{{user.nombre}}</strong>, cómo vas en <strong style="color:#F59E0B;">{{user.planilla_nombre}}</strong>:
    </p>
  </td></tr>

  <!-- Stats -->
  <tr><td style="padding:16px 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:0 6px 0 0;text-align:center;">
          <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px 8px;">
            <div style="font-size:26px;font-weight:900;color:#ffffff;">#{{user.ranking_position}}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;">Posición</div>
          </div>
        </td>
        <td style="padding:0 3px;text-align:center;">
          <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px 8px;">
            <div style="font-size:26px;font-weight:900;color:#F59E0B;">{{user.puntos_totales}}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;">Puntos</div>
          </div>
        </td>
        <td style="padding:0 0 0 6px;text-align:center;">
          <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:16px 8px;">
            <div style="font-size:26px;font-weight:900;color:#10b981;">🔥{{user.current_streak}}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;">Racha</div>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 32px;">
    <div style="text-align:center;">
      <a href="https://prodecaballito.com" style="display:inline-block;background:#F59E0B;color:#000;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;">Ver mi ranking →</a>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #2a2a2a;">
    <div style="font-size:12px;color:#4b5563;">ProdeCaballito · {{user.planilla_nombre}}</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>$T8$,
    "updatedAt" = now()
  WHERE name = 'email_weekly_digest' AND "tenantId" = v_tenant_id;

  -- ────────────────────────────────────────────────────────────────────────────
  -- email_verification_code
  -- Payload: business_context.code
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE templates SET
    subject = '🎯 Tu código de acceso a ProdeCaballito',
    body = $T9$<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;">

  <tr><td style="padding:28px 32px 0;text-align:center;">
    <div style="font-size:28px;font-weight:900;color:#F59E0B;letter-spacing:-1px;">PRODE Caballito</div>
  </td></tr>

  <tr><td style="padding:24px 32px 0;text-align:center;">
    <p style="margin:0;font-size:15px;color:#d1d5db;">Hola <strong style="color:#ffffff;">{{user.nombre}}</strong>, tu código de verificación es:</p>
  </td></tr>

  <tr><td style="padding:16px 32px 0;">
    <div style="background:#111;border:2px solid #F59E0B;border-radius:12px;padding:24px;text-align:center;">
      <div style="font-size:40px;font-weight:900;letter-spacing:8px;color:#F59E0B;font-family:monospace;">{{business_context.code}}</div>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;text-align:center;">
    <p style="margin:0;font-size:13px;color:#6b7280;">Este código vence en 15 minutos. No lo compartas con nadie.</p>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #2a2a2a;">
    <div style="font-size:12px;color:#4b5563;">ProdeCaballito</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>$T9$,
    "updatedAt" = now()
  WHERE name = 'email_verification_code' AND "tenantId" = v_tenant_id;

  -- ────────────────────────────────────────────────────────────────────────────
  -- email_tournament_tomorrow
  -- Payload: business_context.{tournament_name, first_match}
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE templates SET
    subject = '🏟️ ¡Mañana arranca {{business_context.tournament_name}}!',
    body = $T10$<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;">

  <tr><td style="padding:40px 32px 24px;text-align:center;">
    <div style="font-size:48px;">🏟️</div>
    <div style="font-size:24px;font-weight:900;color:#F59E0B;margin-top:12px;">¡Mañana arranca!</div>
    <div style="font-size:16px;color:#d1d5db;margin-top:6px;">{{business_context.tournament_name}}</div>
  </td></tr>

  <tr><td style="padding:0 32px 20px;">
    <p style="margin:0;font-size:15px;color:#d1d5db;">
      Hola <strong style="color:#ffffff;">{{user.nombre}}</strong>, mañana empieza la acción.<br>
      Primer partido: <strong style="color:#F59E0B;">{{business_context.first_match}}</strong>
    </p>
  </td></tr>

  <tr><td style="padding:0 32px 24px;">
    <div style="text-align:center;">
      <a href="https://prodecaballito.com" style="display:inline-block;background:#F59E0B;color:#000;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;">Cargar pronósticos →</a>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #2a2a2a;">
    <div style="font-size:12px;color:#4b5563;">ProdeCaballito · {{user.planilla_nombre}}</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>$T10$,
    "updatedAt" = now()
  WHERE name = 'email_tournament_tomorrow' AND "tenantId" = v_tenant_id;

  -- ────────────────────────────────────────────────────────────────────────────
  -- email_result_broadcast
  -- Payload: business_context.{match.{local,away,goles_local,goles_visitante}, exactos_count}
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE templates SET
    subject = '⚽ Resultado: {{business_context.match.local}} {{business_context.match.goles_local}}-{{business_context.match.goles_visitante}} {{business_context.match.away}}',
    body = $T11$<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;">

  <tr><td style="padding:28px 32px 0;text-align:center;">
    <div style="font-size:28px;font-weight:900;color:#F59E0B;letter-spacing:-1px;">PRODE Caballito</div>
  </td></tr>

  <tr><td style="padding:20px 32px 0;">
    <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:20px;text-align:center;">
      <div style="font-size:13px;color:#6b7280;margin-bottom:10px;">Resultado final</div>
      <div style="font-size:18px;font-weight:700;color:#ffffff;">
        {{business_context.match.local}}
        <span style="color:#F59E0B;margin:0 12px;font-size:24px;">{{business_context.match.goles_local}} - {{business_context.match.goles_visitante}}</span>
        {{business_context.match.away}}
      </div>
      <div style="font-size:13px;color:#9ca3af;margin-top:10px;">{{business_context.exactos_count}} exactos en el grupo</div>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 8px;">
    <p style="margin:0;font-size:14px;color:#9ca3af;text-align:center;">
      Hola {{user.nombre}}, entrá a ver cómo quedaste.
    </p>
  </td></tr>

  <tr><td style="padding:12px 32px 20px;">
    <div style="text-align:center;">
      <a href="https://prodecaballito.com" style="display:inline-block;background:#F59E0B;color:#000;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;">Ver mi posición →</a>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #2a2a2a;">
    <div style="font-size:12px;color:#4b5563;">ProdeCaballito · {{user.planilla_nombre}}</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>$T11$,
    "updatedAt" = now()
  WHERE name = 'email_result_broadcast' AND "tenantId" = v_tenant_id;

  -- ────────────────────────────────────────────────────────────────────────────
  -- email_match_rescheduled
  -- Payload: business_context.{match.{local,away}, nueva_fecha, new_datetime}
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE templates SET
    subject = '📅 Cambio de fecha: {{business_context.match.local}} vs {{business_context.match.away}}',
    body = $T12$<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;">

  <tr><td style="padding:28px 32px 0;text-align:center;">
    <div style="font-size:28px;font-weight:900;color:#F59E0B;letter-spacing:-1px;">PRODE Caballito</div>
  </td></tr>

  <tr><td style="padding:20px 32px 0;text-align:center;">
    <div style="font-size:32px;">📅</div>
    <div style="font-size:18px;font-weight:700;color:#ffffff;margin-top:8px;">Partido reprogramado</div>
  </td></tr>

  <tr><td style="padding:16px 32px 0;">
    <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:18px;text-align:center;">
      <div style="font-size:16px;font-weight:700;color:#ffffff;">{{business_context.match.local}} vs {{business_context.match.away}}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:6px;">Nueva fecha:</div>
      <div style="font-size:15px;color:#F59E0B;font-weight:700;margin-top:2px;">{{business_context.nueva_fecha}}</div>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 8px;">
    <p style="margin:0;font-size:14px;color:#9ca3af;text-align:center;">
      Hola {{user.nombre}}, revisá si tu pronóstico sigue vigente.
    </p>
  </td></tr>

  <tr><td style="padding:12px 32px 20px;">
    <div style="text-align:center;">
      <a href="https://prodecaballito.com" style="display:inline-block;background:#F59E0B;color:#000;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;">Ver mis pronósticos →</a>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #2a2a2a;">
    <div style="font-size:12px;color:#4b5563;">ProdeCaballito · {{user.planilla_nombre}}</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>$T12$,
    "updatedAt" = now()
  WHERE name = 'email_match_rescheduled' AND "tenantId" = v_tenant_id;

  -- ────────────────────────────────────────────────────────────────────────────
  -- email_planilla_cierre
  -- Payload: business_context.{planilla_nombre, torneo_name, ranking_after.position, puntos}
  -- Note: the event prode.planilla_cierre sends planilla_nombre and matches array
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE templates SET
    subject = '🏁 Planilla cerrada — {{business_context.planilla_nombre}}',
    body = $T13$<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;">

  <tr><td style="padding:28px 32px 0;text-align:center;">
    <div style="font-size:28px;font-weight:900;color:#F59E0B;letter-spacing:-1px;">PRODE Caballito</div>
  </td></tr>

  <tr><td style="padding:20px 32px 0;text-align:center;">
    <div style="font-size:36px;">🏁</div>
    <div style="font-size:20px;font-weight:700;color:#ffffff;margin-top:8px;">Planilla cerrada</div>
    <div style="font-size:14px;color:#9ca3af;margin-top:4px;">{{business_context.planilla_nombre}} · {{business_context.torneo_name}}</div>
  </td></tr>

  <tr><td style="padding:16px 32px 0;">
    <p style="margin:0;font-size:15px;color:#d1d5db;">
      Hola <strong style="color:#ffffff;">{{user.nombre}}</strong>, la planilla cerró.
    </p>
  </td></tr>

  <tr><td style="padding:12px 32px 20px;">
    <div style="text-align:center;">
      <a href="https://prodecaballito.com" style="display:inline-block;background:#F59E0B;color:#000;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;">Ver resultados finales →</a>
    </div>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #2a2a2a;">
    <div style="font-size:12px;color:#4b5563;">ProdeCaballito · {{user.planilla_nombre}}</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>$T13$,
    "updatedAt" = now()
  WHERE name = 'email_planilla_cierre' AND "tenantId" = v_tenant_id;

  RAISE NOTICE 'Email templates migrated successfully for tenant prodecaballito.';
END $$;
