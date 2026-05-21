import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { asJson } from "../utils/prisma.js";

const createTemplateSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(["email", "sms", "push", "whatsapp", "voice"]),
  subject: z.string().optional(),
  body: z.string().min(1),
  bodyHtml: z.string().optional(),
});

const updateTemplateSchema = createTemplateSchema.partial();

const templatesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticateApiKey);

  // Extract variables from Handlebars template
  function extractVariables(template: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables = new Set<string>();
    let match;
    while ((match = regex.exec(template)) !== null) {
      if (match[1]) variables.add(match[1].trim());
    }
    return Array.from(variables);
  }

  // GET /v1/templates
  fastify.get("/", async (request, _reply) => {
    const {
      channel,
      limit = 50,
      offset = 0,
    } = request.query as {
      channel?: string;
      limit?: number;
      offset?: number;
    };

    const where: Record<string, unknown> = { tenantId: request.tenantId };
    if (channel) where.channel = channel;

    const [templates, total] = await Promise.all([
      fastify.prisma.template.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      fastify.prisma.template.count({ where }),
    ]);

    return { templates, total };
  });

  // POST /v1/templates
  fastify.post("/", async (request, reply) => {
    const body = createTemplateSchema.parse(request.body);
    const variables = extractVariables(body.body);

    const template = await fastify.prisma.template.create({
      data: {
        tenantId: request.tenantId,
        name: body.name,
        channel: body.channel,
        subject: body.subject,
        body: body.body,
        bodyHtml: body.bodyHtml,
        variables: asJson(variables),
        version: 1,
      },
    });

    return reply.status(201).send(template);
  });

  // GET /v1/templates/:id
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const template = await fastify.prisma.template.findFirst({
      where: { id, tenantId: request.tenantId },
    });

    if (!template)
      return reply.status(404).send({ error: "Template not found" });

    return template;
  });

  // PUT /v1/templates/:id
  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateTemplateSchema.parse(request.body);

    const template = await fastify.prisma.template.findFirst({
      where: { id, tenantId: request.tenantId },
    });

    if (!template)
      return reply.status(404).send({ error: "Template not found" });

    const currentVariables = Array.isArray(template.variables)
      ? template.variables
      : [];
    const variables = body.body
      ? extractVariables(body.body)
      : currentVariables;

    const updated = await fastify.prisma.template.update({
      where: { id },
      data: {
        name: body.name ?? template.name,
        channel: body.channel ?? template.channel,
        subject: body.subject ?? template.subject,
        body: body.body ?? template.body,
        bodyHtml: body.bodyHtml ?? template.bodyHtml,
        variables: asJson(variables),
        version: (template.version ?? 1) + 1,
      },
    });

    return updated;
  });

  // DELETE /v1/templates/:id
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const template = await fastify.prisma.template.findFirst({
      where: { id, tenantId: request.tenantId },
    });

    if (!template)
      return reply.status(404).send({ error: "Template not found" });

    await fastify.prisma.template.delete({ where: { id } });

    return reply.status(204).send();
  });
};

export default templatesRoutes;
