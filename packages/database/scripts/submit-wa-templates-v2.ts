import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ACCOUNT_SID = process.env["TWILIO_ACCOUNT_SID"] ?? "";
const AUTH_TOKEN = process.env["TWILIO_AUTH_TOKEN"] ?? "";
const AUTH = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");

async function twilio(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ sid: string }> {
  const res = await fetch(`https://content.twilio.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${AUTH}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok)
    throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<{ sid: string }>;
}

// v2 — sin URLs, textos cortos, categoria UTILITY
// Meta aprueba mas rapido templates sin links externos
const TEMPLATES = [
  {
    name: "wa_bet_reminder",
    friendlyName: "prode_caballito_bet_reminder_v2",
    body: "⚽ {{1}}, todavia no cargaste tus pronosticos para la fecha. Te quedan {{2}} minutos. Entrate ya!",
    variables: { "1": "Carlos", "2": "30" },
  },
  {
    name: "wa_cutoff_reminder",
    friendlyName: "prode_caballito_cutoff_reminder_v2",
    body: "🔔 {{1}}, las apuestas cierran en {{2}} minutos. Es tu ultimo chance!",
    variables: { "1": "Carlos", "2": "10" },
  },
  {
    name: "wa_payment_pending",
    friendlyName: "prode_caballito_payment_pending_v2",
    body: "💳 {{1}}, tu pago esta pendiente en {{2}}. Regulariza tu situacion para seguir jugando.",
    variables: { "1": "Carlos", "2": "Mi Planilla" },
  },
  {
    name: "wa_near_podio",
    friendlyName: "prode_caballito_near_podio_v2",
    body: "🏅 {{1}}, estas a {{2}} puntos del podio en {{3}}. Dale que llegas!",
    variables: { "1": "Carlos", "2": "5", "3": "Mi Planilla" },
  },
  {
    name: "wa_match_rescheduled",
    friendlyName: "prode_caballito_match_rescheduled_v2",
    body: "📅 {{1}} vs {{2}} fue reprogramado para el {{3}} a las {{4}}hs. Tus pronosticos se mantienen.",
    variables: { "1": "Argentina", "2": "Brasil", "3": "20/06", "4": "20:00" },
  },
];

async function main() {
  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { slug: "prodecaballito" },
  });

  for (const tpl of TEMPLATES) {
    const existing = await prisma.template.findFirst({
      where: { tenantId: tenant.id, name: tpl.name, channel: "whatsapp" },
    });

    if (!existing) {
      console.log(`⚠️  Template ${tpl.name} not found in DB — skipping`);
      continue;
    }

    // Create new Content Template in Twilio (v2 without URLs)
    const content = await twilio("POST", "/Content", {
      friendly_name: tpl.friendlyName,
      language: "es",
      variables: tpl.variables,
      types: { "twilio/text": { body: tpl.body } },
    });
    console.log(`✅ Created ${tpl.name} v2 → ${content.sid}`);

    // Submit for WhatsApp approval
    await twilio("POST", `/Content/${content.sid}/ApprovalRequests/whatsapp`, {
      name: tpl.friendlyName,
      category: "UTILITY",
    });
    console.log(`📤 Submitted ${tpl.name} v2 for WhatsApp approval`);

    // Replace old pending SID with new one in DB
    await prisma.template.update({
      where: { id: existing.id },
      data: {
        twilioContentSid: content.sid,
        twilioApprovalStatus: "pending",
      },
    });
    console.log(`💾 DB updated: ${tpl.name} → ${content.sid}`);
  }

  console.log("\n🎉 Done — v2 templates submitted without URLs.");
  console.log(
    "The check-wa-approvals cron will activate them when Meta approves.",
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
