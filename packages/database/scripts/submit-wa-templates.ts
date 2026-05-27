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

// Bodies use Twilio positional vars ({{1}}, {{2}}) — they map to the Handlebars variables
// rendered at delivery time. Keep them short and simple for Meta approval (UTILITY category).
const TEMPLATES = [
  {
    name: "wa_welcome",
    friendlyName: "prode_caballito_welcome",
    body: "¡Bienvenido a ProdeCaballito, {{1}}! 🎉 Ya sos parte de {{2}}. ¡A predecir!",
    variables: { "1": "Carlos", "2": "Mi Planilla" },
  },
  {
    name: "wa_bet_reminder",
    friendlyName: "prode_caballito_bet_reminder",
    body: "⚽ Hola {{1}}! Todavía no cargaste tus pronósticos. Te quedan {{2}} minutos. prodecaballito.com/apuestas",
    variables: { "1": "Carlos", "2": "30" },
  },
  {
    name: "wa_cutoff_reminder",
    friendlyName: "prode_caballito_cutoff_reminder",
    body: "🔔 {{1}}, las apuestas cierran en {{2}} minutos. prodecaballito.com/apuestas",
    variables: { "1": "Carlos", "2": "10" },
  },
  {
    name: "wa_payment_pending",
    friendlyName: "prode_caballito_payment_pending",
    body: "💳 {{1}}, tu pago está pendiente en {{2}}. prodecaballito.com/pago",
    variables: { "1": "Carlos", "2": "Mi Planilla" },
  },
  {
    name: "wa_near_podio",
    friendlyName: "prode_caballito_near_podio",
    body: "🏅 {{1}}, estás cerca del podio en {{2}}. ¡Seguí así! prodecaballito.com/ranking",
    variables: { "1": "Carlos", "2": "Mi Planilla" },
  },
  {
    name: "wa_match_rescheduled",
    friendlyName: "prode_caballito_match_rescheduled",
    body: "📅 {{1}} vs {{2}} reprogramado al {{3}} {{4}}hs. Tus pronósticos se mantienen. prodecaballito.com/apuestas",
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

    if (existing.twilioContentSid) {
      console.log(
        `⏩ ${tpl.name} already submitted (${existing.twilioContentSid}) — skipping`,
      );
      continue;
    }

    const content = await twilio("POST", "/Content", {
      friendly_name: tpl.friendlyName,
      language: "es",
      variables: tpl.variables,
      types: { "twilio/text": { body: tpl.body } },
    });
    console.log(`✅ Created ${tpl.name} → ${content.sid}`);

    await twilio("POST", `/Content/${content.sid}/ApprovalRequests/whatsapp`, {
      name: tpl.friendlyName,
      category: "UTILITY",
    });
    console.log(`📤 Submitted ${tpl.name} for WhatsApp approval`);

    await prisma.template.update({
      where: { id: existing.id },
      data: { twilioContentSid: content.sid, twilioApprovalStatus: "pending" },
    });
  }

  console.log("\n🎉 Done — waiting for Meta approval (~24-48h).");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
