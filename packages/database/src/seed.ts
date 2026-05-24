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
      "Outbound voice survey call (TODO: validate script format with ProdeCaballito)",
  },
] as const;

// ─── WhatsApp Pre-approved Meta Templates ────────────────────────────────────

const WA_TEMPLATES = [
  {
    name: "wa_nuevo_lider",
    body: "¡Hay un nuevo líder en {{user.planilla_nombre}}! {{user.nombre}} trepó al primer puesto. ¿Podés alcanzarlo?",
    aiInstructions: JSON.stringify({
      twilioTemplateSid: "HX3d2e4229b56b20d222ae85b64a2e607e",
      templateVars: {},
    }),
  },
  {
    name: "wa_resultado_partido",
    body: "Resultado {{business_context.match.local}} {{business_context.match.goles_local}}-{{business_context.match.goles_visitante}} {{business_context.match.away}}. Vos pronosticaste {{business_context.bet.goles_local}}-{{business_context.bet.goles_visitante}} y sumaste {{business_context.puntos}} pts.",
    aiInstructions: JSON.stringify({
      twilioTemplateSid: "HX7ed5ef7d53402b094a81ecd8d4cbf5af",
      templateVars: {},
    }),
  },
  {
    name: "wa_ganador_fecha",
    body: "¡{{user.nombre}} ganó la fecha en {{user.planilla_nombre}}! Felicitaciones al campeón. 🏆",
    aiInstructions: JSON.stringify({
      twilioTemplateSid: "HX037ab7e8789f1de1575a26737ff8a233",
      templateVars: {},
    }),
  },
  {
    name: "wa_bet_reminder",
    body: "⚽ Hola {{user.nombre}}! Todavía no cargaste tus pronósticos para la fecha. Te quedan {{business_context.horas}} horas. Entrá ya!",
    aiInstructions: null,
  },
  {
    name: "wa_payment_pending",
    body: "💳 {{user.nombre}}, tu pago está pendiente. Para seguir jugando en {{user.planilla_nombre}} necesitás regularizar tu situación.",
    aiInstructions: null,
  },
  {
    name: "wa_welcome",
    body: "¡Bienvenido a ProdeCaballito, {{user.nombre}}! 🎉 Ya sos parte de {{user.planilla_nombre}}. ¡A predecir!",
    aiInstructions: null,
  },
  {
    name: "wa_near_podio",
    body: "🏅 {{user.nombre}}, estás a solo {{business_context.posiciones}} lugar(es) del podio en {{user.planilla_nombre}}. ¡Dale que llegás!",
    aiInstructions: null,
  },
  {
    name: "wa_match_rescheduled",
    body: "📅 El partido {{business_context.match.local}} vs {{business_context.match.away}} fue reprogramado para el {{business_context.nueva_fecha}}. Revisá tus pronósticos.",
    aiInstructions: null,
  },
  {
    name: "wa_cutoff_reminder",
    body: "⏰ ¡ÚLTIMO AVISO! El cierre de pronósticos para {{business_context.fecha_nombre}} es en {{business_context.minutos}} minutos.",
    aiInstructions: null,
  },
] as const;

// ─── Email Templates ──────────────────────────────────────────────────────────

const EMAIL_TEMPLATES = [
  {
    name: "email_verification_code",
    subject: "Tu código de acceso a ProdeCaballito",
    body: "Hola {{user.nombre}},\n\nTu código de verificación es: **{{business_context.code}}**\n\nVence en 10 minutos.",
  },
  {
    name: "email_welcome",
    subject: "¡Bienvenido a ProdeCaballito, {{user.nombre}}!",
    body: "Hola {{user.nombre}},\n\nYa estás registrado en {{user.planilla_nombre}}. ¡A pronosticar!",
  },
  {
    name: "email_result_individual",
    subject:
      "Resultado: {{business_context.match.local}} {{business_context.match.goles_local}}-{{business_context.match.goles_visitante}} {{business_context.match.away}}",
    body: "Hola {{user.nombre}},\n\nResultado: {{business_context.match.local}} {{business_context.match.goles_local}}-{{business_context.match.goles_visitante}} {{business_context.match.away}}\n\nTu pronóstico: {{business_context.bet.goles_local}}-{{business_context.bet.goles_visitante}}\nPuntos obtenidos: {{business_context.puntos}}\nRanking actual: #{{business_context.ranking_after.position}} en {{user.planilla_nombre}}",
  },
  {
    name: "email_result_broadcast",
    subject: "Resultados de la fecha — {{user.planilla_nombre}}",
    body: "Hola {{user.nombre}},\n\nYa están los resultados de la fecha en {{user.planilla_nombre}}. Entrá a ver tu posición.",
  },
  {
    name: "email_payment_pending",
    subject: "⚠️ Pago pendiente en ProdeCaballito",
    body: "Hola {{user.nombre}},\n\nTenés un pago pendiente para continuar participando en {{user.planilla_nombre}}. Regularizá tu situación para no perder tu posición.",
  },
  {
    name: "email_winner_personal",
    subject: "🏆 ¡Ganaste la fecha en {{user.planilla_nombre}}!",
    body: "Hola {{user.nombre}},\n\n¡Felicitaciones! Ganaste la fecha con {{business_context.puntos}} puntos en {{user.planilla_nombre}}. ¡Sos el mejor!",
  },
  {
    name: "email_winner_broadcast",
    subject: "🏆 Hay un ganador en {{user.planilla_nombre}}",
    body: "Hola {{user.nombre}},\n\n{{business_context.ganador}} ganó la fecha en {{user.planilla_nombre}} con {{business_context.puntos}} puntos. ¿Podés superarlo la próxima?",
  },
  {
    name: "email_matchday_summary",
    subject: "Resumen de fecha — {{user.planilla_nombre}}",
    body: "Hola {{user.nombre}},\n\nAcá está tu resumen de la fecha:\n- Puntos: {{business_context.puntos}}\n- Posición: #{{business_context.ranking_after.position}}\n- Exactos: {{business_context.exactos}}\n\nSeguí así!",
  },
  {
    name: "email_weekly_digest",
    subject: "Tu semana en ProdeCaballito",
    body: "Hola {{user.nombre}},\n\nEsta semana en {{user.planilla_nombre}}:\n- Posición: #{{user.ranking_position}}\n- Puntos acumulados: {{user.puntos_totales}}\n- Racha exactos: {{user.current_streak}}\n\n¡Seguí pronosticando!",
  },
  {
    name: "email_bet_reminder",
    subject: "⚽ ¡No olvidés tus pronósticos!",
    body: "Hola {{user.nombre}},\n\nTodavía no cargaste tus pronósticos para la próxima fecha en {{user.planilla_nombre}}. El cierre es pronto.",
  },
  {
    name: "email_match_rescheduled",
    subject:
      "📅 Cambio de fecha: {{business_context.match.local}} vs {{business_context.match.away}}",
    body: "Hola {{user.nombre}},\n\nEl partido {{business_context.match.local}} vs {{business_context.match.away}} fue reprogramado para el {{business_context.nueva_fecha}}. Revisá tus pronósticos si es necesario.",
  },
  {
    name: "email_tournament_tomorrow",
    subject: "🏟️ ¡Mañana empieza el torneo!",
    body: "Hola {{user.nombre}},\n\nMañana arranca la acción en {{user.planilla_nombre}}. ¿Ya tenés listos tus pronósticos?",
  },
  {
    name: "email_planilla_cierre",
    subject:
      "Planilla cerrada — Resultados finales de {{user.planilla_nombre}}",
    body: "Hola {{user.nombre}},\n\nLa planilla {{user.planilla_nombre}} cerró. Tu posición final fue #{{business_context.ranking_after.position}} con {{business_context.puntos}} puntos totales. ¡Hasta la próxima!",
  },
] as const;

// ─── SMS Templates ────────────────────────────────────────────────────────────

const SMS_TEMPLATES = [
  {
    name: "sms_verification_code",
    body: "ProdeCaballito: Tu código es {{business_context.code}}. Vence en 10 min.",
  },
  {
    name: "sms_bet_reminder",
    body: "⚽ {{user.nombre}}: faltan {{business_context.horas}}hs para el cierre. ¡Cargá tus pronósticos en ProdeCaballito!",
  },
  {
    name: "sms_cutoff_reminder",
    body: "⏰ URGENTE {{user.nombre}}: el cierre es en {{business_context.minutos}} minutos. ¡Ya!",
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
    body: "🏅 {{user.nombre}} entró al top {{business_context.ranking_after.position}} en {{user.planilla_nombre}}! Seguí así.",
  },
  {
    name: "sms_ranking_up",
    body: "📈 {{user.nombre}} subió al puesto #{{business_context.ranking_after.position}} en {{user.planilla_nombre}} (+{{business_context.ranking_after.delta}} lugares).",
  },
  {
    name: "sms_ranking_passed",
    body: "😤 {{user.nombre}}, te superaron en {{user.planilla_nombre}}. Ahora estás #{{business_context.ranking_after.position}}. ¡A reaccionar!",
  },
  {
    name: "sms_personal_record",
    body: "🎯 {{user.nombre}} batiste tu récord! {{business_context.puntos}} pts en una fecha. ¡Crack!",
  },
  {
    name: "sms_streak_exactos",
    body: "🔥 {{user.nombre}}: {{user.current_streak}} exactos consecutivos! Estás en racha.",
  },
  {
    name: "sms_payment_pending",
    body: "💳 {{user.nombre}}: tenés un pago pendiente en ProdeCaballito. Regularizá para seguir jugando.",
  },
  {
    name: "sms_near_podio",
    body: "🏅 {{user.nombre}}, ¡estás a {{business_context.posiciones}} del podio en {{user.planilla_nombre}}! Dale.",
  },
  {
    name: "sms_tournament_tomorrow",
    body: "🏟️ ¡Mañana arranca {{user.tournament_name}}! ¿Ya tenés tus pronósticos, {{user.nombre}}?",
  },
  {
    name: "sms_match_rescheduled",
    body: "📅 {{business_context.match.local}} vs {{business_context.match.away}} se reprogramó al {{business_context.nueva_fecha}}. ProdeCaballito.",
  },
  {
    name: "sms_planilla_cierre",
    body: "🏁 {{user.planilla_nombre}} cerró. {{user.nombre}} terminó #{{business_context.ranking_after.position}} con {{business_context.puntos}}pts. ¡Hasta la próxima!",
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
          data: { body: tpl.body, aiInstructions: tpl.aiInstructions },
        })
      : await prisma.template.create({
          data: {
            tenantId: tenant.id,
            name: tpl.name,
            channel: "whatsapp",
            subject: "",
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
      name: "PC: voice_survey → Voice (TODO: validate script)",
      eventType: "prode.voice_survey",
      enabled: false, // disabled until voice survey format is validated with ProdeCaballito
      priority: 5,
      cooldownSeconds: 86400,
      actions: [{ type: "SEND_NOTIFICATION", params: { channel: "voice" } }],
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
