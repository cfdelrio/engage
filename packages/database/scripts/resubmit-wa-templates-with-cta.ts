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

// v2 of the 3 already-approved templates — same content but with CTA
// asking user to reply, which opens the 24h free-form session window.
const TEMPLATES = [
  {
    name: "wa_nuevo_lider",
    friendlyName: "prode_caballito_nuevo_lider_v2",
    body: "🏆 ¡Hay un nuevo líder en {{1}}! {{2}} trepó al primer puesto. ¿Podés alcanzarlo?\n\nRespondé a este mensaje para recibir las próximas actualizaciones por WhatsApp 👍",
    variables: { "1": "Mi Planilla", "2": "Carlos" },
  },
  {
    name: "wa_resultado_partido",
    friendlyName: "prode_caballito_resultado_v2",
    body: "⚽ Resultado: {{1}} {{2}}-{{3}} {{4}}. Vos pronosticaste {{5}}-{{6}} y sumaste {{7}} pts.\n\nRespondé a este mensaje para recibir los próximos resultados por WhatsApp 👍",
    variables: {
      "1": "Argentina",
      "2": "2",
      "3": "1",
      "4": "Brasil",
      "5": "2",
      "6": "1",
      "7": "3",
    },
  },
  {
    name: "wa_ganador_fecha",
    friendlyName: "prode_caballito_ganador_v2",
    body: "🏆 ¡{{1}} ganó la fecha en {{2}}! Felicitaciones al campeón.\n\nRespondé a este mensaje para recibir las próximas novedades por WhatsApp 👍",
    variables: { "1": "Carlos", "2": "Mi Planilla" },
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

    // Create new Content Template in Twilio
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

    // Store new SID — keep old subject (still works), update twilioContentSid to the new one
    // When approved, the cron will set subject = new SID automatically
    await prisma.template.update({
      where: { id: existing.id },
      data: {
        twilioContentSid: content.sid,
        twilioApprovalStatus: "pending",
      },
    });
    console.log(`💾 DB updated: ${tpl.name} twilioContentSid → ${content.sid}`);
  }

  console.log(
    "\n🎉 Done — v2 templates submitted. Old SIDs still active until Meta approves the new ones.",
  );
  console.log(
    "The check-wa-approvals cron will auto-activate them when approved.",
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
