#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const templates = [
  {
    name: "wa_ganador_fecha",
    eventType: "prode.winner.personal",
    sid: "HX037ab7e8789f1de1575a26737ff8a233",
    body: "🏆 ¡{{1}} ganó {{2}}!\nCon {{3}} puntos exactos.\n\n👉 prodecaballito.com/ranking",
    variables: [
      { position: 1, name: "winner_name", description: "Nombre del ganador" },
      { position: 2, name: "position", description: "Posición en ranking" },
      {
        position: 3,
        name: "exact_points",
        description: "Puntos exactos obtenidos",
      },
    ],
  },
  {
    name: "wa_nuevo_lider",
    eventType: "prode.new_leader",
    sid: "HX3d2e4229b56b20d222ae85b64a2e607e",
    body: "🔥 ¡Sos el nuevo líder del PRODE Caballito!\nCon {{1}} puntos estás en el puesto #1.\n\n¡No lo sueltes! 👉 prodecaballito.com/ranking",
    variables: [
      {
        position: 1,
        name: "points",
        description: "Puntos totales del nuevo líder",
      },
    ],
  },
  {
    name: "wa_resultado_partido",
    eventType: "prode.result_published.individual",
    sid: "HX7ed5ef7d53402b094a81ecd8d4cbf5af",
    body: "⚽ {{1}} {{2}}-{{3}} {{4}}\n\n{{5}}\n🏆 Estás #{{6}} en el ranking\n\n👉 prodecaballito.com/ranking",
    variables: [
      { position: 1, name: "home_team", description: "Equipo local" },
      { position: 2, name: "home_goals", description: "Goles equipo local" },
      {
        position: 3,
        name: "away_goals",
        description: "Goles equipo visitante",
      },
      { position: 4, name: "away_team", description: "Equipo visitante" },
      { position: 5, name: "outcome", description: "Resultado (exacto/etc)" },
      {
        position: 6,
        name: "ranking_position",
        description: "Posición en ranking",
      },
    ],
  },
];

async function main() {
  const tenantSlug = "prodecaballito";
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant) {
    console.error(`❌ Tenant "${tenantSlug}" no encontrado`);
    process.exit(1);
  }

  console.log(`✅ Tenant ${tenantSlug} encontrado (${tenant.id})`);

  for (const template of templates) {
    const updated = await prisma.template.updateMany({
      where: {
        tenantId: tenant.id,
        channel: "whatsapp",
        name: template.name,
      },
      data: {
        subject: template.sid, // Almacenamos SID en subject para Twilio Content Template
        body: template.body,
        variables: template.variables,
        version: 2,
      },
    });

    console.log(
      `✅ ${template.name}: ${updated.count} templates actualizados (SID: ${template.sid})`,
    );
  }

  console.log("\n✅ Todos los templates restaurados con éxito");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
