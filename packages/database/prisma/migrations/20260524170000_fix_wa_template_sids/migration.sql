-- Data migration: set Twilio Content Template SIDs in template.subject
-- The delivery-scheduler reads template.subject against /^HX[a-f0-9]{32}$/ to
-- detect HSM templates. These 3 rows had the SID only in aiInstructions JSON,
-- leaving subject empty and causing freeform delivery (rejected by Twilio).

UPDATE "templates"
SET "subject" = 'HX3d2e4229b56b20d222ae85b64a2e607e', "aiInstructions" = NULL
WHERE "channel" = 'whatsapp' AND "name" = 'wa_nuevo_lider' AND "subject" = '';

UPDATE "templates"
SET "subject" = 'HX7ed5ef7d53402b094a81ecd8d4cbf5af', "aiInstructions" = NULL
WHERE "channel" = 'whatsapp' AND "name" = 'wa_resultado_partido' AND "subject" = '';

UPDATE "templates"
SET "subject" = 'HX037ab7e8789f1de1575a26737ff8a233', "aiInstructions" = NULL
WHERE "channel" = 'whatsapp' AND "name" = 'wa_ganador_fecha' AND "subject" = '';
