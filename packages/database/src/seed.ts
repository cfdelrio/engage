import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

// ─── ProdeCaballito Event Types ───────────────────────────────────────────────

const PRODE_EVENT_TYPES = [
  {
    type: "prode.verification_code",
    description: "OTP code requested by user",
  },
  { type: "prode.welcome", description: "New user registration complete" },
  {
    type: "prode.bet_reminder",
    description: "Reminder to submit bets before cutoff",
  },
  {
    type: "prode.cutoff_reminder",
    description: "Urgent: bet cutoff approaching",
  },
  {
    type: "prode.match_rescheduled",
    description: "Match date/time changed",
  },
  {
    type: "prode.payment_pending",
    description: "Payment required to continue playing",
  },
  { type: "prode.kickoff", description: "Match kicked off" },
  { type: "prode.second_half", description: "Second half started" },
  {
    type: "prode.result_published.broadcast",
    description: "Match result published — broadcast to all participants",
  },
  {
    type: "prode.result_published.individual",
    description: "Match result with personalized score for a specific user",
  },
  {
    type: "prode.new_leader",
    description: "A new leader has taken the top position",
  },
  {
    type: "prode.ranking_change.entered",
    description: "User entered the top ranking positions",
  },
  {
    type: "prode.ranking_change.up",
    description: "User moved up in the ranking",
  },
  {
    type: "prode.ranking_change.down",
    description: "User moved down in the ranking",
  },
  {
    type: "prode.ranking_passed",
    description: "User was overtaken by another player",
  },
  {
    type: "prode.near_podio",
    description: "User is within 3 positions of the podium",
  },
  {
    type: "prode.tournament_tomorrow",
    description: "Tournament starts tomorrow",
  },
  {
    type: "prode.matchday_summary",
    description: "End-of-matchday summary with standings",
  },
  {
    type: "prode.personal_record",
    description: "User achieved a new personal record",
  },
  {
    type: "prode.streak_exactos",
    description: "User has a streak of exact score predictions",
  },
  {
    type: "prode.winner.personal",
    description: "User won their planilla",
  },
  {
    type: "prode.winner.broadcast",
    description: "Broadcast: a planilla winner has been crowned",
  },
  { type: "prode.weekly_digest", description: "Weekly performance digest" },
  {
    type: "prode.planilla_cierre",
    description: "Planilla closed — final standings confirmed",
  },
  {
    type: "prode.broadcast_manual",
    description: "Admin-triggered broadcast message",
  },
  {
    type: "prode.voice_survey",
    description:
      "Llamada de encuesta de satisfacción para usuarios de ProdeCaballito",
  },
  {
    type: "prode.voice_nuevo_lider",
    description: "Voice: llamada al nuevo líder del ranking",
  },
  {
    type: "prode.voice_perfect_score",
    description: "Voice: llamada al usuario que acertó un exacto",
  },
  {
    type: "prode.voice_match_reminder",
    description:
      "Voice: recordatorio de partido próximo (25-35 min antes del kickoff)",
  },
  {
    type: "prode.voice_weekly_summary",
    description: "Voice: resumen semanal del ranking",
  },
  {
    type: "prode.voice_survey_campeon",
    description: "Voice: encuesta de predicción de campeón mundial",
  },
  {
    type: "prode.voice_trash_talk",
    description:
      "Voice: notificación de rivalidad (un usuario superó a otro en el ranking)",
  },
] as const;

// ─── WhatsApp Pre-approved Meta Templates ────────────────────────────────────

const WA_TEMPLATES = [
  {
    name: "wa_nuevo_lider",
    subject: "HX3d2e4229b56b20d222ae85b64a2e607e",
    body: "¡Hay un nuevo líder en {{user.planilla_nombre}}! {{user.nombre}} trepó al primer puesto. ¿Podés alcanzarlo?",
    aiInstructions: null,
  },
  {
    name: "wa_resultado_partido",
    subject: "HX7ed5ef7d53402b094a81ecd8d4cbf5af",
    body: "Resultado {{business_context.match.local}} {{business_context.match.goles_local}}-{{business_context.match.goles_visitante}} {{business_context.match.away}}. Vos pronosticaste {{business_context.bet.goles_local}}-{{business_context.bet.goles_visitante}} y sumaste {{business_context.bet.puntos_obtenidos}} pts.",
    aiInstructions: null,
  },
  {
    name: "wa_ganador_fecha",
    subject: "HX037ab7e8789f1de1575a26737ff8a233",
    body: "¡{{user.nombre}} ganó la fecha en {{user.planilla_nombre}}! Felicitaciones al campeón. 🏆",
    aiInstructions: null,
  },
  {
    name: "wa_bet_reminder",
    subject: "",
    body: "⚽ Hola {{user.nombre}}! Todavía no cargaste tus pronósticos para la fecha. Te quedan {{business_context.remind_minutes}} minutos. Entrá ya!",
    aiInstructions: null,
  },
  {
    name: "wa_payment_pending",
    subject: "",
    body: "💳 {{user.nombre}}, tu pago está pendiente. Para seguir jugando en {{user.planilla_nombre}} necesitás regularizar tu situación.",
    aiInstructions: null,
  },
  {
    name: "wa_welcome",
    subject: "",
    body: "¡Bienvenido a ProdeCaballito, {{user.nombre}}! 🎉 Ya sos parte de {{user.planilla_nombre}}. ¡A predecir!",
    aiInstructions: null,
  },
  {
    name: "wa_near_podio",
    subject: "",
    body: "🏅 {{user.nombre}}, estás a {{business_context.gap}} puntos del podio en {{business_context.planilla_nombre}}. ¡Dale que llegás!",
    aiInstructions: null,
  },
  {
    name: "wa_match_rescheduled",
    subject: "",
    body: "📅 El partido {{business_context.match.local}} vs {{business_context.match.away}} fue reprogramado para el {{business_context.match.new_datetime}}. Revisá tus pronósticos.",
    aiInstructions: null,
  },
  {
    name: "wa_cutoff_reminder",
    subject: "",
    body: "⏰ ¡ÚLTIMO AVISO! El cierre de pronósticos para {{business_context.tournament_name}} es en {{business_context.minutes_left}} minutos.",
    aiInstructions: null,
  },
] as const;

// ─── Email Templates ──────────────────────────────────────────────────────────
// HTML responsive mobile-first: navy #001A4B / orange #F47C00 / white background
// Handlebars context: { user: { nombre, email, ...metadata }, ...event.payload }
// business_context fields come from event.payload.business_context

const H =
  '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;"><tr><td align="center" style="padding:24px 16px;"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;"><tr><td style="background:#001A4B;padding:20px 32px;text-align:center;"><span style="font-size:22px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">⚽ PRODE Caballito</span></td></tr>';
const F =
  '<tr><td style="background:#F8FAFC;padding:20px 32px;text-align:center;border-top:1px solid #E2E8F0;"><p style="margin:0;font-size:13px;color:#94A3B8;">Con cariño, el equipo de PRODE Caballito ❤️ | <a href="https://prodecaballito.com" style="color:#F47C00;text-decoration:none;">prodecaballito.com</a></p></td></tr></table></td></tr></table></body></html>';
const CTA = (url: string, text: string) =>
  `<tr><td style="padding:8px 32px 32px;text-align:center;"><a href="${url}" style="display:inline-block;background:#F47C00;color:#ffffff;font-family:'Arial Black',Arial,sans-serif;font-weight:900;font-size:16px;padding:16px 36px;border-radius:50px;text-decoration:none;">${text}</a></td></tr>`;

const EMAIL_TEMPLATES = [
  {
    name: "email_verification_code",
    subject: "🎯 Código de Verificación - PRODE Caballito",
    body:
      H +
      '<tr><td style="padding:32px 32px 16px;text-align:center;"><p style="margin:0;font-size:16px;color:#475569;">Hola, <strong style="color:#001A4B;">{{user.nombre}}</strong></p><p style="margin:10px 0 0;font-size:16px;color:#1E293B;">Tu código de verificación es:</p></td></tr>' +
      '<tr><td style="padding:16px 32px;text-align:center;"><div style="display:inline-block;background:#F1F5F9;border:2px dashed #CBD5E1;border-radius:12px;padding:24px 40px;"><span style="font-family:\'Courier New\',Courier,monospace;font-size:42px;font-weight:700;color:#001A4B;letter-spacing:8px;">{{code}}</span></div></td></tr>' +
      '<tr><td style="padding:16px 32px 32px;text-align:center;"><p style="margin:0;font-size:14px;color:#64748B;">Este código <strong>expira en 15 minutos</strong>.</p><p style="margin:12px 0 0;font-size:13px;color:#94A3B8;">Si no solicitaste esto, ignorá este correo.</p></td></tr>' +
      F,
  },
  {
    name: "email_welcome",
    subject:
      "🔥 ¡{{user.nombre}}, el Mundial 2026 arranca — ya sos parte del PRODE!",
    body:
      H +
      '<tr><td style="background:#001A4B;padding:0 32px 32px;text-align:center;"><p style="margin:0;font-size:38px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#F47C00;letter-spacing:-1px;line-height:1.1;">ESTO YA EMPEZÓ</p><p style="margin:8px 0 0;font-size:18px;color:#93C5FD;font-weight:700;">¿VAS A JUGAR O MIRAR?</p></td></tr>' +
      '<tr><td style="padding:28px 32px 8px;"><p style="margin:0;font-size:16px;color:#1E293B;">Hola <strong style="color:#001A4B;">{{user.nombre}}</strong>, YA ESTÁS ADENTRO del PRODE Caballito.</p><p style="margin:10px 0 0;font-size:15px;color:#475569;line-height:1.6;">Cargá tus pronósticos antes de que empiece la acción.</p></td></tr>' +
      '<tr><td style="padding:16px 32px 8px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;"><tr><td style="background:#F1F5F9;padding:10px 16px;"><p style="margin:0;font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">CÓMO JUGAR EN 3 PASOS</p></td></tr><tr><td style="padding:12px 16px;border-top:1px solid #E2E8F0;"><p style="margin:0;font-size:14px;color:#1E293B;"><strong style="color:#F47C00;">1.</strong> Entrá a /apuestas → seleccioná el torneo</p></td></tr><tr><td style="padding:12px 16px;border-top:1px solid #E2E8F0;"><p style="margin:0;font-size:14px;color:#1E293B;"><strong style="color:#F47C00;">2.</strong> Ingresá el marcador para cada partido</p></td></tr><tr><td style="padding:12px 16px;border-top:1px solid #E2E8F0;"><p style="margin:0;font-size:14px;color:#1E293B;"><strong style="color:#F47C00;">3.</strong> ¡Guardá y listo! (se guarda automático)</p></td></tr></table></td></tr>' +
      '<tr><td style="padding:16px 32px 8px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;"><tr><td colspan="2" style="background:#001A4B;padding:10px 16px;text-align:center;"><p style="margin:0;font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;">SISTEMA DE PUNTOS</p></td></tr><tr><td style="padding:10px 16px;border-top:1px solid #E2E8F0;font-size:14px;color:#1E293B;">Marcador exacto (ej: 2-1 = 2-1)</td><td style="padding:10px 16px;border-top:1px solid #E2E8F0;text-align:right;font-size:16px;font-weight:900;color:#F47C00;">4 pts</td></tr><tr><td style="padding:10px 16px;border-top:1px solid #E2E8F0;font-size:14px;color:#1E293B;">Resultado correcto (local gana)</td><td style="padding:10px 16px;border-top:1px solid #E2E8F0;text-align:right;font-size:16px;font-weight:900;color:#001A4B;">3 pts</td></tr><tr><td style="padding:10px 16px;border-top:1px solid #E2E8F0;font-size:14px;color:#1E293B;">No acertaste nada</td><td style="padding:10px 16px;border-top:1px solid #E2E8F0;text-align:right;font-size:16px;font-weight:700;color:#94A3B8;">0 pts</td></tr></table></td></tr>' +
      '<tr><td style="padding:16px 32px 8px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:12px 16px;"><p style="margin:0;font-size:14px;color:#92400E;">⏰ <strong>Las apuestas cierran 5 minutos antes del primer partido.</strong></p></td></tr></table></td></tr>' +
      CTA("https://prodecaballito.com/apuestas", "⚽ EMPEZAR A JUGAR AHORA →") +
      F,
  },
  {
    name: "email_result_individual",
    subject:
      "🎯 Resultado: {{business_context.home_team}} {{business_context.resultado_local}}-{{business_context.resultado_visitante}} {{business_context.away_team}} — sumaste {{business_context.puntos_obtenidos}} pts",
    body:
      H +
      '<tr><td style="background:#001A4B;padding:28px 32px;text-align:center;"><p style="margin:0;font-size:30px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">{{business_context.home_team}}</p><p style="margin:8px 0;font-size:44px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#F47C00;letter-spacing:2px;">{{business_context.resultado_local}} - {{business_context.resultado_visitante}}</p><p style="margin:0;font-size:30px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">{{business_context.away_team}}</p></td></tr>' +
      '<tr><td style="padding:24px 32px 8px;"><p style="margin:0;font-size:15px;color:#475569;">Hola <strong style="color:#001A4B;">{{user.nombre}}</strong>, así te fue en este partido:</p></td></tr>' +
      '<tr><td style="padding:8px 32px 8px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;"><tr><td width="50%" style="padding:16px;text-align:center;border-right:1px solid #E2E8F0;"><p style="margin:0;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">TU PRONÓSTICO</p><p style="margin:8px 0 0;font-size:32px;font-weight:900;color:#001A4B;font-family:\'Arial Black\',Arial,sans-serif;">{{business_context.goles_local}}-{{business_context.goles_visitante}}</p></td><td width="50%" style="padding:16px;text-align:center;"><p style="margin:0;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">RESULTADO REAL</p><p style="margin:8px 0 0;font-size:32px;font-weight:900;color:#001A4B;font-family:\'Arial Black\',Arial,sans-serif;">{{business_context.resultado_local}}-{{business_context.resultado_visitante}}</p></td></tr></table></td></tr>' +
      '<tr><td style="padding:16px 32px 8px;text-align:center;"><div style="display:inline-block;background:#F47C00;color:#ffffff;padding:12px 28px;border-radius:50px;font-weight:900;font-size:20px;font-family:\'Arial Black\',Arial,sans-serif;">+{{business_context.puntos_obtenidos}} pts{{#if business_context.outcome}} — {{business_context.outcome}}{{/if}}</div></td></tr>' +
      '<tr><td style="padding:8px 32px 8px;text-align:center;"><p style="margin:0;font-size:15px;color:#475569;">Tu posición en el ranking: <strong style="color:#001A4B;font-size:18px;">#{{business_context.ranking_position}}</strong></p></td></tr>' +
      CTA("https://prodecaballito.com/ranking", "Ver ranking →") +
      F,
  },
  {
    name: "email_result_broadcast",
    subject: "Resultados de la fecha — {{user.planilla_nombre}}",
    body:
      H +
      '<tr><td style="padding:28px 32px 8px;text-align:center;"><p style="margin:0;font-size:28px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#001A4B;">⚽ RESULTADOS</p></td></tr>' +
      '<tr><td style="padding:8px 32px 8px;"><p style="margin:0;font-size:15px;color:#475569;">Hola <strong style="color:#001A4B;">{{user.nombre}}</strong>, ya están los resultados de la fecha en <strong>{{user.planilla_nombre}}</strong>. Entrá a ver tu posición.</p></td></tr>' +
      CTA("https://prodecaballito.com/ranking", "Ver mi posición →") +
      F,
  },
  {
    name: "email_payment_pending",
    subject: "⚠️ Pago pendiente en ProdeCaballito",
    body:
      H +
      '<tr><td style="background:#FEF2F2;padding:20px 32px;text-align:center;border-bottom:1px solid #FECACA;"><p style="margin:0;font-size:20px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#DC2626;">⚠️ PAGO PENDIENTE</p></td></tr>' +
      '<tr><td style="padding:24px 32px 8px;"><p style="margin:0;font-size:15px;color:#1E293B;">Hola <strong>{{user.nombre}}</strong>, tenés un pago pendiente para continuar participando en <strong>{{user.planilla_nombre}}</strong>.</p><p style="margin:12px 0 0;font-size:15px;color:#475569;">Regularizá tu situación para no perder tu posición.</p></td></tr>' +
      CTA("https://prodecaballito.com", "Regularizar pago →") +
      F,
  },
  {
    name: "email_winner_personal",
    subject: "🏆 ¡{{user.nombre}}, ganaste {{business_context.matchday_name}}!",
    body:
      H +
      '{{#if business_context.image_url}}<tr><td style="padding:0;"><img src="{{business_context.image_url}}" alt="¡Ganaste!" width="600" style="width:100%;max-width:600px;display:block;"></td></tr>{{/if}}' +
      '<tr><td style="background:#001A4B;padding:28px 32px;text-align:center;"><p style="margin:0;font-size:14px;color:#93C5FD;text-transform:uppercase;letter-spacing:1px;">{{business_context.matchday_name}}</p><p style="margin:8px 0;font-size:42px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#F47C00;letter-spacing:-1px;line-height:1.1;">¡GANASTE!</p><p style="margin:0;font-size:22px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#ffffff;">CON {{business_context.points}} PUNTOS</p></td></tr>' +
      '<tr><td style="padding:24px 32px 8px;text-align:center;"><p style="margin:0;font-size:16px;color:#1E293B;line-height:1.6;font-style:italic;">{{business_context.scorer_line}}</p></td></tr>' +
      CTA(
        "https://prodecaballito.com/ganadas",
        "Ver mi historial de victorias →",
      ) +
      F,
  },
  {
    name: "email_winner_broadcast",
    subject:
      "🏆 {{business_context.winner_name}} ganó {{business_context.matchday_name}}",
    body:
      H +
      '<tr><td style="background:#001A4B;padding:28px 32px;text-align:center;"><p style="margin:0;font-size:13px;color:#93C5FD;text-transform:uppercase;letter-spacing:1px;">CRACK DE LA FECHA</p><p style="margin:8px 0;font-size:36px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#F47C00;letter-spacing:-0.5px;">{{business_context.winner_name}}</p><p style="margin:0;font-size:18px;color:#ffffff;font-weight:700;">{{business_context.points}} puntos · {{business_context.matchday_name}}</p></td></tr>' +
      '<tr><td style="padding:24px 32px 8px;"><p style="margin:0;font-size:15px;color:#475569;">Hola <strong style="color:#001A4B;">{{user.nombre}}</strong>, {{business_context.scorer_line}}</p></td></tr>' +
      CTA("https://prodecaballito.com/ranking", "Ver ranking →") +
      F,
  },
  {
    name: "email_matchday_summary",
    subject: "Resumen de fecha — {{business_context.matchday_name}}",
    body:
      H +
      '<tr><td style="padding:28px 32px 8px;text-align:center;"><p style="margin:0;font-size:24px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#001A4B;">Tu resumen ⚽</p><p style="margin:6px 0 0;font-size:15px;color:#64748B;">{{business_context.matchday_name}}</p></td></tr>' +
      '<tr><td style="padding:8px 32px 16px;"><p style="margin:0;font-size:15px;color:#475569;">Hola <strong style="color:#001A4B;">{{user.nombre}}</strong>, acá están tus números:</p></td></tr>' +
      '<tr><td style="padding:0 32px 16px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td width="33%" style="padding:0 4px 0 0;text-align:center;"><div style="background:#F1F5F9;border-radius:8px;padding:16px 8px;"><div style="font-size:30px;font-weight:900;color:#F47C00;font-family:\'Arial Black\',Arial,sans-serif;">{{business_context.points}}</div><div style="font-size:11px;color:#64748B;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">Puntos</div></div></td><td width="34%" style="padding:0 2px;text-align:center;"><div style="background:#F1F5F9;border-radius:8px;padding:16px 8px;"><div style="font-size:30px;font-weight:900;color:#001A4B;font-family:\'Arial Black\',Arial,sans-serif;">#{{business_context.rank_in_matchday}}</div><div style="font-size:11px;color:#64748B;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">En la fecha</div></div></td><td width="33%" style="padding:0 0 0 4px;text-align:center;"><div style="background:#F1F5F9;border-radius:8px;padding:16px 8px;"><div style="font-size:30px;font-weight:900;color:#001A4B;font-family:\'Arial Black\',Arial,sans-serif;">#{{business_context.global_position}}</div><div style="font-size:11px;color:#64748B;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">Global</div></div></td></tr></table></td></tr>' +
      '<tr><td style="padding:0 32px 8px;"><div style="background:#F1F5F9;border-radius:8px;padding:14px 16px;"><p style="margin:0;font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Ganador de la fecha</p><p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#001A4B;">🏆 {{business_context.top_name}} — {{business_context.top_points}} pts</p></div></td></tr>' +
      CTA("https://prodecaballito.com/ranking", "Ver ranking completo →") +
      F,
  },
  {
    name: "email_weekly_digest",
    subject:
      "📊 Tu semana en PRODE — posición #{{business_context.ranking_position}}",
    body:
      H +
      '<tr><td style="padding:28px 32px 8px;"><p style="margin:0;font-size:16px;color:#1E293B;">Hola <strong style="color:#001A4B;">{{user.nombre}}</strong>, así cerró tu semana:</p></td></tr>' +
      '<tr><td style="padding:8px 32px 16px;"><div style="background:#001A4B;border-radius:8px;padding:20px 24px;text-align:center;"><p style="margin:0;font-size:13px;color:#93C5FD;text-transform:uppercase;letter-spacing:0.5px;">Tu posición</p><p style="margin:6px 0;font-size:40px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#F47C00;">#{{business_context.ranking_position}}</p><p style="margin:0;font-size:16px;color:#ffffff;font-weight:700;">{{business_context.puntos_totales}} puntos totales</p></div></td></tr>' +
      '{{#if business_context.diferencia_puntos}}<tr><td style="padding:0 32px 8px;"><div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:14px 16px;"><p style="margin:0;font-size:14px;color:#1D4ED8;">📈 Te faltan <strong>{{business_context.diferencia_puntos}} pts</strong> para entrar al top 5.</p></div></td></tr>{{/if}}' +
      '<tr><td style="padding:8px 32px 8px;"><div style="background:#F1F5F9;border-radius:8px;padding:14px 16px;"><p style="margin:0;font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Tu mejor jornada</p><p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#001A4B;">{{business_context.best_round_pts}} pts — Jornada {{business_context.best_round_jornada}}</p></div></td></tr>' +
      '{{#if business_context.pending_bets}}<tr><td style="padding:8px 32px 8px;"><div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:12px 16px;"><p style="margin:0;font-size:14px;color:#92400E;">⏰ <strong>Tenés {{business_context.pending_bets}} pronóstico(s) pendiente(s).</strong> ¡No te los pierdas!</p></div></td></tr>{{/if}}' +
      CTA("https://prodecaballito.com/apuestas", "Apostar ahora →") +
      F,
  },
  {
    name: "email_bet_reminder",
    subject:
      "⏰ Cerrás en {{business_context.minutes_left}} min — {{business_context.pending_bets}} pronóstico(s) sin cargar",
    body:
      H +
      '<tr><td style="background:#DC2626;padding:24px 32px;text-align:center;"><p style="margin:0;font-size:26px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#ffffff;line-height:1.2;">⏰ CERRÁS EN {{business_context.minutes_left}} MINUTOS</p></td></tr>' +
      '<tr><td style="padding:24px 32px 8px;"><p style="margin:0;font-size:16px;color:#1E293B;line-height:1.6;"><strong style="color:#001A4B;">{{user.nombre}}</strong>, te quedan <strong style="color:#DC2626;">{{business_context.minutes_left}} minutos</strong> para cargar tus pronósticos en <strong>{{business_context.tournament_name}}</strong>.</p>{{#if business_context.first_match}}<p style="margin:12px 0 0;font-size:15px;color:#475569;">El primer partido es <strong>{{business_context.first_match.local}} vs {{business_context.first_match.away}}</strong>.</p>{{/if}}</td></tr>' +
      CTA("https://prodecaballito.com/apuestas", "⚡ CARGAR AHORA →") +
      F,
  },
  {
    name: "email_match_rescheduled",
    subject:
      "📅 Cambio de fecha: {{business_context.match.local}} vs {{business_context.match.away}}",
    body:
      H +
      '<tr><td style="padding:28px 32px 8px;"><p style="margin:0;font-size:15px;color:#1E293B;">Hola <strong>{{user.nombre}}</strong>, el partido <strong>{{business_context.match.local}} vs {{business_context.match.away}}</strong> fue reprogramado para el <strong>{{business_context.match.new_datetime}}</strong>.</p><p style="margin:12px 0 0;font-size:15px;color:#475569;">Revisá tus pronósticos si es necesario.</p></td></tr>' +
      CTA("https://prodecaballito.com/apuestas", "Ver mis pronósticos →") +
      F,
  },
  {
    name: "email_tournament_tomorrow",
    subject: "🏟️ ¡Mañana empieza el torneo!",
    body:
      H +
      '<tr><td style="background:#001A4B;padding:24px 32px;text-align:center;"><p style="margin:0;font-size:28px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#F47C00;">MAÑANA ARRANCA ⚽</p></td></tr>' +
      '<tr><td style="padding:24px 32px 8px;"><p style="margin:0;font-size:15px;color:#1E293B;">Hola <strong>{{user.nombre}}</strong>, mañana arranca la acción en <strong>{{user.planilla_nombre}}</strong>. ¿Ya tenés listos tus pronósticos?</p></td></tr>' +
      CTA("https://prodecaballito.com/apuestas", "Cargar pronósticos →") +
      F,
  },
  {
    name: "email_planilla_cierre",
    subject:
      '✅ Tu planilla "{{business_context.planilla_nombre}}" está lista para {{business_context.torneo_name}}',
    body:
      H +
      '<tr><td style="background:#059669;padding:20px 32px;text-align:center;"><p style="margin:0;font-size:22px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#ffffff;">✅ PLANILLA LISTA</p><p style="margin:6px 0 0;font-size:15px;color:#D1FAE5;">{{business_context.planilla_nombre}} · {{business_context.torneo_name}}</p></td></tr>' +
      '<tr><td style="padding:24px 32px 8px;"><p style="margin:0;font-size:15px;color:#475569;">Hola <strong style="color:#001A4B;">{{user.nombre}}</strong>, tus pronósticos para <strong>{{business_context.torneo_name}}</strong>:</p></td></tr>' +
      '<tr><td style="padding:8px 32px 16px;"><table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #E2E8F0;"><tr style="background:#001A4B;"><td style="padding:10px 14px;font-size:12px;font-weight:700;color:#93C5FD;text-transform:uppercase;letter-spacing:0.5px;">PARTIDO</td><td style="padding:10px 14px;font-size:12px;font-weight:700;color:#93C5FD;text-transform:uppercase;letter-spacing:0.5px;text-align:right;">TU PRONÓSTICO</td></tr>{{#each business_context.matches}}<tr style="border-top:1px solid #E2E8F0;"><td style="padding:12px 14px;font-size:14px;color:#1E293B;">{{this.home_team}} vs {{this.away_team}}</td><td style="padding:12px 14px;font-size:14px;font-weight:700;color:#001A4B;text-align:right;">{{#if this.goles_local}}{{this.goles_local}}-{{this.goles_visitante}}{{else}}—{{/if}}</td></tr>{{/each}}</table></td></tr>' +
      CTA("https://prodecaballito.com/apuestas", "Ver mi planilla →") +
      F,
  },
  {
    name: "email_new_leader",
    subject:
      "🏆 ¡{{user.nombre}}, sos el nuevo líder de {{business_context.tournament_name}}!",
    body:
      H +
      '<tr><td style="background:#001A4B;padding:32px 32px;text-align:center;"><p style="margin:0;font-size:16px;color:#93C5FD;text-transform:uppercase;letter-spacing:2px;">RANKING</p><p style="margin:8px 0;font-size:52px;font-family:\'Arial Black\',Arial,sans-serif;font-weight:900;color:#F47C00;letter-spacing:-2px;line-height:1;">¡LLEGASTE<br>AL #1!</p><p style="margin:12px 0 0;font-size:20px;color:#ffffff;font-weight:700;">{{business_context.puntos_totales}} puntos</p></td></tr>' +
      '<tr><td style="padding:24px 32px 8px;text-align:center;"><p style="margin:0;font-size:16px;color:#1E293B;"><strong style="color:#001A4B;">{{user.nombre}}</strong>, sos el nuevo líder de <strong>{{business_context.tournament_name}}</strong>.</p><p style="margin:12px 0 0;font-size:15px;color:#475569;">Ahora a defenderlo. 💪</p></td></tr>' +
      CTA("https://prodecaballito.com/ranking", "Ver mi posición →") +
      F,
  },
];

// ─── SMS Templates ────────────────────────────────────────────────────────────

const SMS_TEMPLATES = [
  {
    name: "sms_verification_code",
    body: "ProdeCaballito: Tu código es {{code}}. Vence en 10 min.",
  },
  {
    name: "sms_bet_reminder",
    body: "⚽ {{user.nombre}}: faltan {{business_context.remind_minutes}} min para el cierre. ¡Cargá tus pronósticos en ProdeCaballito!",
  },
  {
    name: "sms_cutoff_reminder",
    body: "⏰ URGENTE {{user.nombre}}: el cierre es en {{business_context.minutes_left}} minutos. ¡Ya!",
  },
  {
    name: "sms_kickoff",
    body: "🟢 Arranca {{business_context.match.local}} vs {{business_context.match.away}}! Suerte {{user.nombre}} 🤞",
  },
  {
    name: "sms_second_half",
    body: "⚽ Segundo tiempo: {{business_context.match.local}} {{business_context.match.goles_local}}-{{business_context.match.goles_visitante}} {{business_context.match.away}}",
  },
  {
    name: "sms_ranking_entered",
    body: "🏅 {{user.nombre}} entró al puesto #{{business_context.new_rank}} en {{business_context.planilla_nombre}}! Seguí así.",
  },
  {
    name: "sms_ranking_up",
    body: "📈 {{user.nombre}} subió al puesto #{{business_context.new_rank}} en {{business_context.planilla_nombre}} (+{{business_context.delta}} lugares).",
  },
  {
    name: "sms_ranking_passed",
    body: "😤 {{user.nombre}}, te superaron en {{user.planilla_nombre}}. Ahora estás #{{business_context.ranking_after.position}}. ¡A reaccionar!",
  },
  {
    name: "sms_personal_record",
    body: "🎯 {{user.nombre}} batiste tu récord! {{business_context.points}} pts en una fecha. ¡Crack!",
  },
  {
    name: "sms_streak_exactos",
    body: "🔥 {{user.nombre}}: {{business_context.streak}} exactos consecutivos! Estás en racha.",
  },
  {
    name: "sms_payment_pending",
    body: "💳 {{user.nombre}}: tenés un pago pendiente en ProdeCaballito. Regularizá para seguir jugando.",
  },
  {
    name: "sms_near_podio",
    body: "🏅 {{user.nombre}}, ¡estás a {{business_context.gap}} puntos del podio en {{business_context.planilla_nombre}}! Dale.",
  },
  {
    name: "sms_tournament_tomorrow",
    body: "🏟️ ¡Mañana arranca {{user.tournament_name}}! ¿Ya tenés tus pronósticos, {{user.nombre}}?",
  },
  {
    name: "sms_match_rescheduled",
    body: "📅 {{business_context.match.local}} vs {{business_context.match.away}} se reprogramó al {{business_context.match.new_datetime}}. ProdeCaballito.",
  },
  {
    name: "sms_planilla_cierre",
    body: "🏁 {{business_context.planilla_nombre}} cerró en {{business_context.torneo_name}}. ¡Gracias por jugar, {{user.nombre}}!",
  },
] as const;

async function main() {
  console.log("🌱 Seeding ProdeCaballito tenant...");

  // ─── Tenant ───────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "prodecaballito" },
    update: {},
    create: {
      slug: "prodecaballito",
      name: "ProdeCaballito",
      plan: "enterprise",
      settings: {
        aiConfig: {
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          temperature: 0.3,
          toneInstructions:
            "Tono futbolero argentino, apasionado pero respetuoso. Usar emojis con moderación. Mensajes cortos y directos.",
          enabled: true,
        },
        maxFrequencyPerHour: 3,
      },
    },
  });

  console.log(`Tenant: ${tenant.slug} (${tenant.id})`);

  // ─── API Key ──────────────────────────────────────────────────────────────
  const rawKey = `oek_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.substring(0, 10);

  await prisma.tenantApiKey.upsert({
    where: { keyHash },
    update: {},
    create: {
      tenantId: tenant.id,
      keyHash,
      keyPrefix,
      name: "Development Key",
      permissions: ["events:write", "events:read"],
    },
  });

  console.log(`API Key: ${keyPrefix}... (save it, shown only once)`);
  console.log(`Raw key: ${rawKey}`);

  // ─── Event Definitions ────────────────────────────────────────────────────
  for (const et of PRODE_EVENT_TYPES) {
    await prisma.eventDefinition
      .create({
        data: { tenantId: tenant.id, ...et, schema: {}, version: 1 },
      })
      .catch(() => {});
  }
  console.log(
    `Event definitions: ${PRODE_EVENT_TYPES.length} created/verified`,
  );

  // ─── Templates ────────────────────────────────────────────────────────────
  // Always update body/subject so re-running the seed fixes broken variables in prod.
  const tplMap: Record<string, string> = {};

  for (const tpl of WA_TEMPLATES) {
    const existing = await prisma.template.findFirst({
      where: { tenantId: tenant.id, name: tpl.name },
    });
    const t = existing
      ? await prisma.template.update({
          where: { id: existing.id },
          data: {
            subject: tpl.subject,
            body: tpl.body,
            aiInstructions: tpl.aiInstructions,
          },
        })
      : await prisma.template.create({
          data: {
            tenantId: tenant.id,
            name: tpl.name,
            channel: "whatsapp",
            subject: tpl.subject,
            body: tpl.body,
            aiInstructions: tpl.aiInstructions,
            variables: [],
            version: 1,
          },
        });
    tplMap[tpl.name] = t.id;
  }

  for (const tpl of EMAIL_TEMPLATES) {
    const existing = await prisma.template.findFirst({
      where: { tenantId: tenant.id, name: tpl.name },
    });
    const t = existing
      ? await prisma.template.update({
          where: { id: existing.id },
          data: { subject: tpl.subject, body: tpl.body },
        })
      : await prisma.template.create({
          data: {
            tenantId: tenant.id,
            name: tpl.name,
            channel: "email",
            subject: tpl.subject,
            body: tpl.body,
            variables: [],
            version: 1,
          },
        });
    tplMap[tpl.name] = t.id;
  }

  for (const tpl of SMS_TEMPLATES) {
    const existing = await prisma.template.findFirst({
      where: { tenantId: tenant.id, name: tpl.name },
    });
    const t = existing
      ? await prisma.template.update({
          where: { id: existing.id },
          data: { body: tpl.body },
        })
      : await prisma.template.create({
          data: {
            tenantId: tenant.id,
            name: tpl.name,
            channel: "sms",
            subject: "",
            body: tpl.body,
            variables: [],
            version: 1,
          },
        });
    tplMap[tpl.name] = t.id;
  }

  console.log(`Templates: ${Object.keys(tplMap).length} upserted`);

  // ─── Rules ────────────────────────────────────────────────────────────────
  const makeCondition = (eventType: string) => ({
    operator: "AND",
    conditions: [{ field: "event.type", operator: "eq", value: eventType }],
  });

  const rules = [
    {
      name: "PC: verification_code → SMS + Email",
      eventType: "prode.verification_code",
      enabled: true,
      priority: 20,
      cooldownSeconds: 60,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "sms",
            templateId: tplMap["sms_verification_code"],
          },
        },
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "email",
            templateId: tplMap["email_verification_code"],
          },
        },
      ],
    },
    {
      name: "PC: welcome → Email + WhatsApp",
      eventType: "prode.welcome",
      enabled: true,
      priority: 15,
      cooldownSeconds: 3600,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "email", templateId: tplMap["email_welcome"] },
        },
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "whatsapp", templateId: tplMap["wa_welcome"] },
        },
      ],
    },
    {
      name: "PC: bet_reminder → SMS + WhatsApp",
      eventType: "prode.bet_reminder",
      enabled: true,
      priority: 10,
      cooldownSeconds: 3600,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "sms", templateId: tplMap["sms_bet_reminder"] },
        },
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "whatsapp",
            templateId: tplMap["wa_bet_reminder"],
          },
        },
      ],
    },
    {
      name: "PC: cutoff_reminder → SMS + WhatsApp",
      eventType: "prode.cutoff_reminder",
      enabled: true,
      priority: 18,
      cooldownSeconds: 300,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "sms", templateId: tplMap["sms_cutoff_reminder"] },
        },
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "whatsapp",
            templateId: tplMap["wa_cutoff_reminder"],
          },
        },
      ],
    },
    {
      name: "PC: match_rescheduled → Email + WhatsApp + SMS",
      eventType: "prode.match_rescheduled",
      enabled: true,
      priority: 12,
      cooldownSeconds: 300,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "email",
            templateId: tplMap["email_match_rescheduled"],
          },
        },
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "whatsapp",
            templateId: tplMap["wa_match_rescheduled"],
          },
        },
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "sms",
            templateId: tplMap["sms_match_rescheduled"],
          },
        },
      ],
    },
    {
      name: "PC: payment_pending → Email + SMS + WhatsApp",
      eventType: "prode.payment_pending",
      enabled: true,
      priority: 15,
      cooldownSeconds: 86400,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "email",
            templateId: tplMap["email_payment_pending"],
          },
        },
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "sms", templateId: tplMap["sms_payment_pending"] },
        },
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "whatsapp",
            templateId: tplMap["wa_payment_pending"],
          },
        },
      ],
    },
    {
      name: "PC: kickoff → SMS",
      eventType: "prode.kickoff",
      enabled: true,
      priority: 8,
      cooldownSeconds: 600,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "sms", templateId: tplMap["sms_kickoff"] },
        },
      ],
    },
    {
      name: "PC: second_half → SMS",
      eventType: "prode.second_half",
      enabled: true,
      priority: 7,
      cooldownSeconds: 600,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "sms", templateId: tplMap["sms_second_half"] },
        },
      ],
    },
    {
      name: "PC: result_published.broadcast → Email",
      eventType: "prode.result_published.broadcast",
      enabled: true,
      priority: 10,
      cooldownSeconds: 300,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "email",
            templateId: tplMap["email_result_broadcast"],
          },
        },
      ],
    },
    {
      name: "PC: result_published.individual → Email + WhatsApp (SID)",
      eventType: "prode.result_published.individual",
      enabled: true,
      priority: 10,
      cooldownSeconds: 300,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "email",
            templateId: tplMap["email_result_individual"],
          },
        },
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "whatsapp",
            templateId: tplMap["wa_resultado_partido"],
          },
        },
      ],
    },
    {
      name: "PC: new_leader → WhatsApp (SID)",
      eventType: "prode.new_leader",
      enabled: true,
      priority: 12,
      cooldownSeconds: 600,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "whatsapp", templateId: tplMap["wa_nuevo_lider"] },
        },
      ],
    },
    {
      name: "PC: ranking_change.entered → SMS",
      eventType: "prode.ranking_change.entered",
      enabled: true,
      priority: 9,
      cooldownSeconds: 1800,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "sms", templateId: tplMap["sms_ranking_entered"] },
        },
      ],
    },
    {
      name: "PC: ranking_change.up → SMS",
      eventType: "prode.ranking_change.up",
      enabled: true,
      priority: 7,
      cooldownSeconds: 1800,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "sms", templateId: tplMap["sms_ranking_up"] },
        },
      ],
    },
    {
      name: "PC: ranking_change.down → suppressed",
      eventType: "prode.ranking_change.down",
      enabled: true,
      priority: 5,
      cooldownSeconds: 0,
      actions: [
        { type: "SUPPRESS", params: { reason: "ranking_down_not_notified" } },
      ],
    },
    {
      name: "PC: ranking_passed → SMS",
      eventType: "prode.ranking_passed",
      enabled: true,
      priority: 8,
      cooldownSeconds: 1800,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "sms", templateId: tplMap["sms_ranking_passed"] },
        },
      ],
    },
    {
      name: "PC: near_podio → SMS + WhatsApp",
      eventType: "prode.near_podio",
      enabled: true,
      priority: 10,
      cooldownSeconds: 3600,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "sms", templateId: tplMap["sms_near_podio"] },
        },
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "whatsapp", templateId: tplMap["wa_near_podio"] },
        },
      ],
    },
    {
      name: "PC: tournament_tomorrow → Email + SMS",
      eventType: "prode.tournament_tomorrow",
      enabled: true,
      priority: 10,
      cooldownSeconds: 86400,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "email",
            templateId: tplMap["email_tournament_tomorrow"],
          },
        },
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "sms",
            templateId: tplMap["sms_tournament_tomorrow"],
          },
        },
      ],
    },
    {
      name: "PC: matchday_summary → Email",
      eventType: "prode.matchday_summary",
      enabled: true,
      priority: 8,
      cooldownSeconds: 3600,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "email",
            templateId: tplMap["email_matchday_summary"],
          },
        },
      ],
    },
    {
      name: "PC: personal_record → SMS",
      eventType: "prode.personal_record",
      enabled: true,
      priority: 10,
      cooldownSeconds: 3600,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "sms", templateId: tplMap["sms_personal_record"] },
        },
      ],
    },
    {
      name: "PC: streak_exactos → SMS",
      eventType: "prode.streak_exactos",
      enabled: true,
      priority: 9,
      cooldownSeconds: 86400,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "sms", templateId: tplMap["sms_streak_exactos"] },
        },
      ],
    },
    {
      name: "PC: winner.personal → Email + WhatsApp (SID)",
      eventType: "prode.winner.personal",
      enabled: true,
      priority: 15,
      cooldownSeconds: 300,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "email",
            templateId: tplMap["email_winner_personal"],
          },
        },
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "whatsapp",
            templateId: tplMap["wa_ganador_fecha"],
          },
        },
      ],
    },
    {
      name: "PC: winner.broadcast → Email",
      eventType: "prode.winner.broadcast",
      enabled: true,
      priority: 10,
      cooldownSeconds: 300,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "email",
            templateId: tplMap["email_winner_broadcast"],
          },
        },
      ],
    },
    {
      name: "PC: weekly_digest → Email",
      eventType: "prode.weekly_digest",
      enabled: true,
      priority: 5,
      cooldownSeconds: 604800,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "email",
            templateId: tplMap["email_weekly_digest"],
          },
        },
      ],
    },
    {
      name: "PC: planilla_cierre → Email + SMS",
      eventType: "prode.planilla_cierre",
      enabled: true,
      priority: 12,
      cooldownSeconds: 300,
      actions: [
        {
          type: "SEND_NOTIFICATION",
          params: {
            channel: "email",
            templateId: tplMap["email_planilla_cierre"],
          },
        },
        {
          type: "SEND_NOTIFICATION",
          params: { channel: "sms", templateId: tplMap["sms_planilla_cierre"] },
        },
      ],
    },
    {
      name: "PC: broadcast_manual → Email + SMS + WhatsApp",
      eventType: "prode.broadcast_manual",
      enabled: true,
      priority: 10,
      cooldownSeconds: 0,
      actions: [
        { type: "SEND_NOTIFICATION", params: { channel: "email" } },
        { type: "SEND_NOTIFICATION", params: { channel: "sms" } },
        { type: "SEND_NOTIFICATION", params: { channel: "whatsapp" } },
      ],
    },
    {
      name: "PC: voice_survey → Encuesta de voz",
      eventType: "prode.voice_survey",
      enabled: true,
      priority: 5,
      cooldownSeconds: 86400,
      actions: [{ type: "SEND_NOTIFICATION", params: { channel: "voice" } }],
    },
    {
      name: "PC: voice_nuevo_lider → Voice",
      eventType: "prode.voice_nuevo_lider",
      enabled: false,
      priority: 5,
      cooldownSeconds: 86400,
      actions: [{ type: "START_VOICE_CAMPAIGN", params: { campaignId: "" } }],
    },
    {
      name: "PC: voice_perfect_score → Voice",
      eventType: "prode.voice_perfect_score",
      enabled: false,
      priority: 5,
      cooldownSeconds: 86400,
      actions: [{ type: "START_VOICE_CAMPAIGN", params: { campaignId: "" } }],
    },
    {
      name: "PC: voice_match_reminder → Voice",
      eventType: "prode.voice_match_reminder",
      enabled: false,
      priority: 5,
      cooldownSeconds: 3600,
      actions: [{ type: "START_VOICE_CAMPAIGN", params: { campaignId: "" } }],
    },
    {
      name: "PC: voice_weekly_summary → Voice",
      eventType: "prode.voice_weekly_summary",
      enabled: false,
      priority: 5,
      cooldownSeconds: 604800,
      actions: [{ type: "START_VOICE_CAMPAIGN", params: { campaignId: "" } }],
    },
    {
      name: "PC: voice_survey_campeon → Voice",
      eventType: "prode.voice_survey_campeon",
      enabled: false,
      priority: 5,
      cooldownSeconds: 86400,
      actions: [{ type: "START_VOICE_CAMPAIGN", params: { campaignId: "" } }],
    },
    {
      name: "PC: voice_trash_talk → Voice",
      eventType: "prode.voice_trash_talk",
      enabled: false,
      priority: 5,
      cooldownSeconds: 3600,
      actions: [{ type: "START_VOICE_CAMPAIGN", params: { campaignId: "" } }],
    },
  ];

  for (const rule of rules) {
    const exists = await prisma.rule.findFirst({
      where: { tenantId: tenant.id, name: rule.name },
    });
    if (!exists) {
      await prisma.rule.create({
        data: {
          tenantId: tenant.id,
          name: rule.name,
          priority: rule.priority,
          enabled: rule.enabled,
          conditions: makeCondition(rule.eventType),
          actions: rule.actions,
          cooldownSeconds: rule.cooldownSeconds,
        },
      });
    }
  }

  console.log(`Rules: ${rules.length} created/verified`);

  // ─── Campaigns (Generic) ─────────────────────────────────────────────────
  const campaigns = [
    {
      name: "Welcome to ProdeCaballito",
      type: "event-triggered",
      status: "draft",
      channels: ["email"],
      trigger: { eventType: "prode.welcome" },
      description: "Welcome email for new users",
    },
    {
      name: "Ranking Update Notification",
      type: "event-triggered",
      status: "draft",
      channels: ["sms", "whatsapp"],
      trigger: { eventType: "prode.ranking_change.up" },
      description: "Notify users when they move up in the ranking",
    },
    {
      name: "Weekly Digest",
      type: "scheduled",
      status: "draft",
      channels: ["email"],
      trigger: { frequency: "weekly", day: "monday", time: "09:00" },
      description: "Send weekly performance summary",
    },
    {
      name: "Match Kickoff Reminder",
      type: "event-triggered",
      status: "active",
      channels: ["sms"],
      trigger: { eventType: "prode.kickoff" },
      description: "Notify users when matches start",
    },
  ];

  for (const campaign of campaigns) {
    const exists = await prisma.campaign.findFirst({
      where: { tenantId: tenant.id, name: campaign.name },
    });
    if (!exists) {
      await prisma.campaign.create({
        data: {
          tenantId: tenant.id,
          name: campaign.name,
          type: campaign.type,
          status: campaign.status,
          channels: campaign.channels,
          trigger: campaign.trigger,
          rules: {},
          aiConfig: {},
        },
      });
    }
  }

  console.log(`Campaigns: ${campaigns.length} created/verified`);

  // ─── Voice Campaigns ──────────────────────────────────────────────────────
  const voiceSurveyFlowSteps = [
    {
      id: "s1",
      type: "say",
      text: "¡Hola! Te llama ProdeCaballito. Tenemos una pregunta rápida sobre tu experiencia de esta semana. Solo te tomará diez segundos.",
    },
    {
      id: "s2",
      type: "dtmf_question",
      text: "¿Cómo calificás tu experiencia jugando el prode esta semana? Presioná 1 si estuvo buenísima, 2 si estuvo bien, o 3 si hay algo para mejorar.",
      options: { "1": "excelente", "2": "buena", "3": "mejorable" },
      timeout: 10,
    },
    {
      id: "s3",
      type: "say",
      text: "¡Muchísimas gracias por tu respuesta! Tu opinión nos ayuda a mejorar el prode. ¡Seguí jugando y que gane el mejor!",
    },
  ];

  const existingVoiceSurvey = await prisma.voiceCampaign.findFirst({
    where: { tenantId: tenant.id, name: "Encuesta de voz - ProdeCaballito" },
  });

  let voiceSurveyCampaignId: string;
  if (!existingVoiceSurvey) {
    const vc = await prisma.voiceCampaign.create({
      data: {
        tenantId: tenant.id,
        name: "Encuesta de voz - ProdeCaballito",
        description:
          "Encuesta de satisfacción por llamada para usuarios del prode. Disparada por regla event-based.",
        status: "active",
        triggerType: "event-based",
        eventType: "prode.voice_survey",
        flowSteps: voiceSurveyFlowSteps,
        ttsProvider: "elevenlabs",
        aiInstructions:
          "Hablá con entusiasmo futbolero argentino, amigable y cercano. Sé breve y claro.",
        script: "",
        voiceConfig: {},
        audienceFilter: {},
        audienceSize: 0,
        stats: {
          sent: 0,
          answered: 0,
          completed: 0,
          failed: 0,
          avgDuration: 0,
        },
      },
    });
    voiceSurveyCampaignId = vc.id;
  } else {
    voiceSurveyCampaignId = existingVoiceSurvey.id;
  }

  // Wire the voice_survey rule to use START_VOICE_CAMPAIGN with the campaign ID
  await prisma.rule.updateMany({
    where: {
      tenantId: tenant.id,
      name: "PC: voice_survey → Encuesta de voz",
    },
    data: {
      enabled: true,
      actions: [
        {
          type: "START_VOICE_CAMPAIGN",
          params: { campaignId: voiceSurveyCampaignId },
        },
      ],
    },
  });

  console.log(`Voice campaigns: 1 created/verified`);

  // ─── Email Campaigns ──────────────────────────────────────────────────────
  for (const [name, data] of [
    [
      "Welcome Email",
      {
        description: "Automatic welcome email for new users",
        status: "draft",
        triggerType: "event",
        subject: "¡Bienvenido a ProdeCaballito!",
        bodyHtml:
          "<h1>Welcome {{user.firstName}}!</h1><p>Thanks for joining ProdeCaballito. Start making predictions now.</p>",
        bodyText:
          "Welcome {{user.firstName}}! Thanks for joining ProdeCaballito. Start making predictions now.",
        fromName: "ProdeCaballito",
        fromEmail: "notifications@prodecaballito.com",
        aiGenerated: false,
      },
    ],
    [
      "Weekly Rankings",
      {
        description: "Weekly rankings digest",
        status: "draft",
        triggerType: "scheduled",
        subject: "Your Weekly Rankings - {{meta.date}}",
        bodyHtml:
          "<h2>Hello {{user.firstName}}</h2><p>You are ranked #{{user.rank}} this week.</p>",
        bodyText: "You are ranked #{{user.rank}} this week.",
        fromName: "ProdeCaballito",
        fromEmail: "notifications@prodecaballito.com",
        aiGenerated: false,
      },
    ],
  ] as const) {
    const exists = await prisma.emailCampaign.findFirst({
      where: { tenantId: tenant.id, name },
    });
    if (!exists) {
      await prisma.emailCampaign.create({
        data: { tenantId: tenant.id, name, ...data },
      });
    }
  }

  console.log("Email campaigns: 2 created/verified");

  // ─── SMS Campaigns ────────────────────────────────────────────────────────
  for (const [name, body, status] of [
    [
      "Match Kickoff Alert",
      "¡Arranca el partido {{match.local}} vs {{match.away}}!",
      "active",
    ],
    [
      "Ranking Change Alert",
      "¡Subiste a posición {{ranking.new_position}}! Acumulás {{ranking.points}} puntos.",
      "draft",
    ],
  ] as const) {
    const exists = await prisma.smsCampaign.findFirst({
      where: { tenantId: tenant.id, name },
    });
    if (!exists) {
      await prisma.smsCampaign.create({
        data: {
          tenantId: tenant.id,
          name,
          status,
          triggerType: "event",
          body,
          aiGenerated: false,
        },
      });
    }
  }

  console.log("SMS campaigns: 2 created/verified");

  // ─── WhatsApp Campaigns ───────────────────────────────────────────────────
  const waExists = await prisma.whatsAppCampaign.findFirst({
    where: { tenantId: tenant.id, name: "Result Notification" },
  });
  if (!waExists) {
    await prisma.whatsAppCampaign.create({
      data: {
        tenantId: tenant.id,
        name: "Result Notification",
        description: "WhatsApp result notification",
        status: "draft",
        triggerType: "event",
        body: "Resultado: {{match.local}} {{match.goles_local}} - {{match.goles_visitante}} {{match.away}}",
      },
    });
  }

  console.log("WhatsApp campaigns: 1 created/verified");

  // ─── Push Campaigns ───────────────────────────────────────────────────────
  const pushExists = await prisma.pushCampaign.findFirst({
    where: { tenantId: tenant.id, name: "New Leader Alert" },
  });
  if (!pushExists) {
    await prisma.pushCampaign.create({
      data: {
        tenantId: tenant.id,
        name: "New Leader Alert",
        description: "Push notification for new leader",
        status: "draft",
        triggerType: "event",
        title: "¡Nuevo líder!",
        body: "{{user.name}} es el nuevo líder con {{user.points}} puntos",
      },
    });
  }

  console.log("Push campaigns: 1 created/verified");

  // ─── Public Feed ──────────────────────────────────────────────────────────
  const feedExists = await prisma.publicFeed.findFirst({
    where: { tenantId: tenant.id, slug: "prodecaballito-updates" },
  });
  if (!feedExists) {
    await prisma.publicFeed.create({
      data: {
        tenantId: tenant.id,
        slug: "prodecaballito-updates",
        name: "ProdeCaballito Updates",
        type: "activity_feed",
        config: {},
        isPublic: true,
      },
    });
  }

  console.log("Public feed created/verified");

  // ─── Channel Providers (optional, requires env vars) ──────────────────────
  const resendApiKey = process.env["RESEND_API_KEY"];
  const twilioAccountSid = process.env["TWILIO_ACCOUNT_SID"];
  const twilioAuthToken = process.env["TWILIO_AUTH_TOKEN"];
  const twilioFromNumber =
    process.env["TWILIO_FROM_NUMBER"] ?? process.env["TWILIO_PHONE_NUMBER"];
  const twilioWaFrom =
    process.env["TWILIO_WHATSAPP_FROM_NUMBER"] ?? twilioFromNumber;

  const providerResults: string[] = [];

  if (resendApiKey) {
    await prisma.channelProvider
      .upsert({
        where: {
          tenantId_channel_provider: {
            tenantId: tenant.id,
            channel: "email",
            provider: "resend",
          },
        },
        create: {
          tenantId: tenant.id,
          channel: "email",
          provider: "resend",
          configEncrypted: JSON.stringify({ apiKey: resendApiKey }),
          isDefault: true,
          isActive: true,
        },
        update: {
          configEncrypted: JSON.stringify({ apiKey: resendApiKey }),
          isActive: true,
        },
      })
      .then(() => providerResults.push("email(resend)"))
      .catch(() => {});
  }

  if (twilioAccountSid && twilioAuthToken && twilioFromNumber) {
    await prisma.channelProvider
      .upsert({
        where: {
          tenantId_channel_provider: {
            tenantId: tenant.id,
            channel: "sms",
            provider: "twilio",
          },
        },
        create: {
          tenantId: tenant.id,
          channel: "sms",
          provider: "twilio",
          configEncrypted: JSON.stringify({
            accountSid: twilioAccountSid,
            authToken: twilioAuthToken,
            from: twilioFromNumber,
          }),
          isDefault: true,
          isActive: true,
        },
        update: {
          configEncrypted: JSON.stringify({
            accountSid: twilioAccountSid,
            authToken: twilioAuthToken,
            from: twilioFromNumber,
          }),
          isActive: true,
        },
      })
      .then(() => providerResults.push("sms(twilio)"))
      .catch(() => {});

    const waFrom = twilioWaFrom ?? twilioFromNumber;
    await prisma.channelProvider
      .upsert({
        where: {
          tenantId_channel_provider: {
            tenantId: tenant.id,
            channel: "whatsapp",
            provider: "twilio-whatsapp",
          },
        },
        create: {
          tenantId: tenant.id,
          channel: "whatsapp",
          provider: "twilio-whatsapp",
          configEncrypted: JSON.stringify({
            accountSid: twilioAccountSid,
            authToken: twilioAuthToken,
            from: waFrom,
          }),
          isDefault: true,
          isActive: true,
        },
        update: {
          configEncrypted: JSON.stringify({
            accountSid: twilioAccountSid,
            authToken: twilioAuthToken,
            from: waFrom,
          }),
          isActive: true,
        },
      })
      .then(() => providerResults.push("whatsapp(twilio-whatsapp)"))
      .catch(() => {});
  }

  if (providerResults.length > 0) {
    console.log(`Channel providers: ${providerResults.join(", ")} configured`);
  } else {
    console.log(
      "Channel providers: none configured (set RESEND_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to enable)",
    );
  }

  console.log("\n✅ Seed completed successfully");
  console.log(`\nTenant ID: ${tenant.id}`);
  console.log(`Tenant slug: ${tenant.slug}`);
  console.log(`\n📋 Event types: ${PRODE_EVENT_TYPES.length}`);
  console.log(
    `📋 Templates: WA=${WA_TEMPLATES.length} Email=${EMAIL_TEMPLATES.length} SMS=${SMS_TEMPLATES.length}`,
  );
  console.log(
    `📋 Rules: ${rules.length} (${rules.filter((r) => !r.enabled).length} disabled pending validation)`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
