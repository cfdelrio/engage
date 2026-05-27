-- Fix wa_resultado_partido: {{business_context.puntos}} → {{business_context.bet.puntos_obtenidos}}
--
-- ProdeCaballito sends prode.result_published.individual with:
--   payload.business_context.bet.puntos_obtenidos  ← puntos ganados en esta apuesta
--   payload.business_context.ranking_after.points   ← puntos totales en el ranking
--
-- Three wa_resultado_partido templates use {{business_context.puntos}} which does not
-- exist in the event payload → renders blank. Correct variable is
-- {{business_context.bet.puntos_obtenidos}}.
--
-- Template cmpleq8iz000113o678vqfkqg also uses {{business_context.ranking_after.puntos_totales}}
-- which is not in the payload either (correct field: ranking_after.points).

-- Fix {{business_context.puntos}} → {{business_context.bet.puntos_obtenidos}}
UPDATE templates SET
  body = REPLACE(body, '{{business_context.puntos}}', '{{business_context.bet.puntos_obtenidos}}'),
  "updatedAt" = now()
WHERE name = 'wa_resultado_partido'
  AND body LIKE '%{{business_context.puntos}}%';

-- Fix {{business_context.ranking_after.puntos_totales}} → {{business_context.ranking_after.points}}
UPDATE templates SET
  body = REPLACE(body, '{{business_context.ranking_after.puntos_totales}}', '{{business_context.ranking_after.points}}'),
  "updatedAt" = now()
WHERE name = 'wa_resultado_partido'
  AND body LIKE '%{{business_context.ranking_after.puntos_totales}}%';
