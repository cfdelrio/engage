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
    body: "¡Hay un nuevo líder en {{planilla}}! {{nombre}} trepó al primer puesto. ¿Podés alcanzarlo?",
    aiInstructions: JSON.stringify({
      twilioTemplateSid: "HX3d2e4229b56b20d222ae85b64a2e607e",
      templateVars: {},
    }),
  },
  {
    name: "wa_resultado_partido",
    body: "Resultado {{local}} {{goles_local}}-{{goles_visitante}} {{away}}. Vos pronosticaste {{pred_local}}-{{pred_visitante}} y sumaste {{puntos}} pts.",
    aiInstructions: JSON.stringify({
      twilioTemplateSid: "HX7ed5ef7d53402b094a81ecd8d4cbf5af",
      templateVars: {},
    }),
  },
  {
    name: "wa_ganador_fecha",
    body: "¡{{nombre}} ganó la fecha en {{planilla}}! Felicitaciones al campeón. 🏆",
    aiInstructions: JSON.stringify({
      twilioTemplateSid: "HX037ab7e8789f1de1575a26737ff8a233",
      templateVars: {},
    }),
  },
  {
    name: "wa_bet_reminder",
    body: "⚽ Hola {{nombre}}! Todavía no cargaste tus pronósticos para la fecha. Te quedan {{horas}} horas. Entrá ya!",
    aiInstructions: null,
  },
  {
    name: "wa_payment_pending",
    body: "💳 {{nombre}}, tu pago está pendiente. Para seguir jugando en {{planilla}} necesitás regularizar tu situación.",
    aiInstructions: null,
  },
  {
    name: "wa_welcome",
    body: "¡Bienvenido a ProdeCaballito, {{nombre}}! 🎉 Ya sos parte de {{planilla}}. ¡A predecir!",
    aiInstructions: null,
  },
  {
    name: "wa_near_podio",
    body: "🏅 {{nombre}}, estás a solo {{posiciones}} lugar(es) del podio en {{planilla}}. ¡Dale que llegás!",
    aiInstructions: null,
  },
  {
    name: "wa_match_rescheduled",
    body: "📅 El partido {{local}} vs {{away}} fue reprogramado para el {{nueva_fecha}}. Revisá tus pronósticos.",
    aiInstructions: null,
  },
  {
    name: "wa_cutoff_reminder",
    body: "⏰ ¡ÚLTIMO AVISO! El cierre de pronósticos para {{fecha_nombre}} es en {{minutos}} minutos.",
    aiInstructions: null,
  },
] as const;

// ─── Email Templates ──────────────────────────────────────────────────────────

const EMAIL_TEMPLATES = [
  {
    name: "email_verification_code",
    subject: "Tu código de acceso a ProdeCaballito",
    body: "Hola {{nombre}},\n\nTu código de verificación es: **{{codigo}}**\n\nVence en 10 minutos.",
  },
  {
    name: "email_welcome",
    subject: "¡Bienvenido a ProdeCaballito, {{nombre}}!",
    body: "Hola {{nombre}},\n\nYa estás registrado en {{planilla}}. ¡A pronosticar!",
  },
  {
    name: "email_result_individual",
    subject:
      "Resultado: {{local}} {{goles_local}}-{{goles_visitante}} {{away}}",
    body: "Hola {{nombre}},\n\nResultado: {{local}} {{goles_local}}-{{goles_visitante}} {{away}}\n\nTu pronóstico: {{pred_local}}-{{pred_visitante}}\nPuntos obtenidos: {{puntos}}\nRanking actual: #{{ranking}} en {{planilla}}",
  },
  {
    name: "email_result_broadcast",
    subject: "Resultados de la fecha — {{planilla}}",
    body: "Hola {{nombre}},\n\nYa están los resultados de la fecha en {{planilla}}. Entrá a ver tu posición.",
  },
  {
    name: "email_payment_pending",
    subject: "⚠️ Pago pendiente en ProdeCaballito",
    body: "Hola {{nombre}},\n\nTenés un pago pendiente para continuar participando en {{planilla}}. Regularizá tu situación para no perder tu posición.",
  },
  {
    name: "email_winner_personal",
    subject: "🏆 ¡Ganaste la fecha en {{planilla}}!",
    body: "Hola {{nombre}},\n\n¡Felicitaciones! Ganaste la fecha con {{puntos}} puntos en {{planilla}}. ¡Sos el mejor!",
  },
  {
    name: "email_winner_broadcast",
    subject: "🏆 Hay un ganador en {{planilla}}",
    body: "Hola {{nombre}},\n\n{{ganador}} ganó la fecha en {{planilla}} con {{puntos}} puntos. ¿Podés superarlo la próxima?",
  },
  {
    name: "email_matchday_summary",
    subject: "Resumen de fecha — {{planilla}}",
    body: "Hola {{nombre}},\n\nAcá está tu resumen de la fecha:\n- Puntos: {{puntos}}\n- Posición: #{{ranking}}\n- Exactos: {{exactos}}\n\nSeguí así!",
  },
  {
    name: "email_weekly_digest",
    subject: "Tu semana en ProdeCaballito",
    body: "Hola {{nombre}},\n\nEsta semana en {{planilla}}:\n- Posición: #{{ranking}}\n- Puntos acumulados: {{puntos_total}}\n- Racha exactos: {{racha}}\n\n¡Seguí pronosticando!",
  },
  {
    name: "email_bet_reminder",
    subject: "⚽ ¡No olvidés tus pronósticos!",
    body: "Hola {{nombre}},\n\nTodavía no cargaste tus pronósticos para la próxima fecha en {{planilla}}. El cierre es pronto.",
  },
  {
    name: "email_match_rescheduled",
    subject: "📅 Cambio de fecha: {{local}} vs {{away}}",
    body: "Hola {{nombre}},\n\nEl partido {{local}} vs {{away}} fue reprogramado para el {{nueva_fecha}}. Revisá tus pronósticos si es necesario.",
  },
  {
    name: "email_tournament_tomorrow",
    subject: "🏟️ ¡Mañana empieza el torneo!",
    body: "Hola {{nombre}},\n\nMañana arranca la acción en {{planilla}}. ¿Ya tenés listos tus pronósticos?",
  },
  {
    name: "email_planilla_cierre",
    subject: "Planilla cerrada — Resultados finales de {{planilla}}",
    body: "Hola {{nombre}},\n\nLa planilla {{planilla}} cerró. Tu posición final fue #{{ranking}} con {{puntos}} puntos totales. ¡Hasta la próxima!",
  },
] as const;

// ─── SMS Templates ────────────────────────────────────────────────────────────

const SMS_TEMPLATES = [
  {
    name: "sms_verification_code",
    body: "ProdeCaballito: Tu código es {{codigo}}. Vence en 10 min.",
  },
  {
    name: "sms_bet_reminder",
    body: "⚽ {{nombre}}: faltan {{horas}}hs para el cierre. ¡Cargá tus pronósticos en ProdeCaballito!",
  },
  {
    name: "sms_cutoff_reminder",
    body: "⏰ URGENTE {{nombre}}: el cierre es en {{minutos}} minutos. ¡Ya!",
  },
  {
    name: "sms_kickoff",
    body: "🟢 Arranca {{local}} vs {{away}}! Suerte {{nombre}} 🤞",
  },
  {
    name: "sms_second_half",
    body: "⚽ Segundo tiempo: {{local}} {{goles_local}}-{{goles_visitante}} {{away}}",
  },
  {
    name: "sms_ranking_entered",
    body: "🏅 {{nombre}} entró al top {{posicion}} en {{planilla}}! Seguí así.",
  },
  {
    name: "sms_ranking_up",
    body: "📈 {{nombre}} subió al puesto #{{posicion}} en {{planilla}} (+{{delta}} lugares).",
  },
  {
    name: "sms_ranking_passed",
    body: "😤 {{nombre}}, te superaron en {{planilla}}. Ahora estás #{{posicion}}. ¡A reaccionar!",
  },
  {
    name: "sms_personal_record",
    body: "🎯 {{nombre}} batiste tu récord! {{puntos}} pts en una fecha. ¡Crack!",
  },
  {
    name: "sms_streak_exactos",
    body: "🔥 {{nombre}}: {{racha}} exactos consecutivos! Estás en racha.",
  },
  {
    name: "sms_payment_pending",
    body: "💳 {{nombre}}: tenés un pago pendiente en ProdeCaballito. Regularizá para seguir jugando.",
  },
  {
    name: "sms_near_podio",
    body: "🏅 {{nombre}}, ¡estás a {{posiciones}} del podio en {{planilla}}! Dale.",
  },
  {
    name: "sms_tournament_tomorrow",
    body: "🏟️ ¡Mañana arranca {{torneo}}! ¿Ya tenés tus pronósticos, {{nombre}}?",
  },
  {
    name: "sms_match_rescheduled",
    body: "📅 {{local}} vs {{away}} se reprogramó al {{nueva_fecha}}. ProdeCaballito.",
  },
  {
    name: "sms_planilla_cierre",
    body: "🏁 {{planilla}} cerró. {{nombre}} terminó #{{ranking}} con {{puntos}}pts. ¡Hasta la próxima!",
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
  const tplMap: Record<string, string> = {};

  for (const tpl of WA_TEMPLATES) {
    const created = await prisma.template
      .create({
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
      })
      .catch(async () =>
        prisma.template.findFirst({
          where: { tenantId: tenant.id, name: tpl.name },
        }),
      );
    if (created) tplMap[tpl.name] = created.id;
  }

  for (const tpl of EMAIL_TEMPLATES) {
    const created = await prisma.template
      .create({
        data: {
          tenantId: tenant.id,
          name: tpl.name,
          channel: "email",
          subject: tpl.subject,
          body: tpl.body,
          variables: [],
          version: 1,
        },
      })
      .catch(async () =>
        prisma.template.findFirst({
          where: { tenantId: tenant.id, name: tpl.name },
        }),
      );
    if (created) tplMap[tpl.name] = created.id;
  }

  for (const tpl of SMS_TEMPLATES) {
    const created = await prisma.template
      .create({
        data: {
          tenantId: tenant.id,
          name: tpl.name,
          channel: "sms",
          subject: "",
          body: tpl.body,
          variables: [],
          version: 1,
        },
      })
      .catch(async () =>
        prisma.template.findFirst({
          where: { tenantId: tenant.id, name: tpl.name },
        }),
      );
    if (created) tplMap[tpl.name] = created.id;
  }

  console.log(`Templates: ${Object.keys(tplMap).length} created/verified`);

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
    await prisma.rule
      .create({
        data: {
          tenantId: tenant.id,
          name: rule.name,
          priority: rule.priority,
          enabled: rule.enabled,
          conditions: makeCondition(rule.eventType),
          actions: rule.actions,
          cooldownSeconds: rule.cooldownSeconds,
        },
      })
      .catch(() => {});
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
    await prisma.campaign
      .create({
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
      })
      .catch(() => {});
  }

  console.log(`Campaigns: ${campaigns.length} created/verified`);

  // ─── Email Campaigns ──────────────────────────────────────────────────────
  await prisma.emailCampaign
    .create({
      data: {
        tenantId: tenant.id,
        name: "Welcome Email",
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
    })
    .catch(() => {});

  await prisma.emailCampaign
    .create({
      data: {
        tenantId: tenant.id,
        name: "Weekly Rankings",
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
    })
    .catch(() => {});

  console.log("Email campaigns: 2 created/verified");

  // ─── SMS Campaigns ────────────────────────────────────────────────────────
  await prisma.smsCampaign
    .create({
      data: {
        tenantId: tenant.id,
        name: "Match Kickoff Alert",
        description: "SMS alert when matches start",
        status: "active",
        triggerType: "event",
        body: "¡Arranca el partido {{match.local}} vs {{match.away}}!",
        aiGenerated: false,
      },
    })
    .catch(() => {});

  await prisma.smsCampaign
    .create({
      data: {
        tenantId: tenant.id,
        name: "Ranking Change Alert",
        description: "Notify when user's ranking changes",
        status: "draft",
        triggerType: "event",
        body: "¡Subiste a posición {{ranking.new_position}}! Acumulás {{ranking.points}} puntos.",
        aiGenerated: false,
      },
    })
    .catch(() => {});

  console.log("SMS campaigns: 2 created/verified");

  // ─── WhatsApp Campaigns ───────────────────────────────────────────────────
  await prisma.whatsAppCampaign
    .create({
      data: {
        tenantId: tenant.id,
        name: "Result Notification",
        description: "WhatsApp result notification",
        status: "draft",
        triggerType: "event",
        body: "Resultado: {{match.local}} {{match.goles_local}} - {{match.goles_visitante}} {{match.away}}",
      },
    })
    .catch(() => {});

  console.log("WhatsApp campaigns: 1 created/verified");

  // ─── Push Campaigns ───────────────────────────────────────────────────────
  await prisma.pushCampaign
    .create({
      data: {
        tenantId: tenant.id,
        name: "New Leader Alert",
        description: "Push notification for new leader",
        status: "draft",
        triggerType: "event",
        title: "¡Nuevo líder!",
        body: "{{user.name}} es el nuevo líder con {{user.points}} puntos",
      },
    })
    .catch(() => {});

  console.log("Push campaigns: 1 created/verified");

  // ─── Public Feed ──────────────────────────────────────────────────────────
  await prisma.publicFeed
    .create({
      data: {
        tenantId: tenant.id,
        slug: "prodecaballito-updates",
        name: "ProdeCaballito Updates",
        type: "activity_feed",
        config: {},
        isPublic: true,
      },
    })
    .catch(() => {});

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
