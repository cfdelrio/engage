import type { ToolDef } from "../types.js";

export const templateTools: ToolDef[] = [
  {
    tool: {
      name: "engage_list_templates",
      description: "List message templates, optionally filtered by channel",
      inputSchema: {
        type: "object",
        properties: {
          channel: {
            type: "string",
            enum: ["email", "sms", "push", "whatsapp", "voice"],
            description: "Filter by channel",
          },
          limit: { type: "number", description: "Max results (default 50)" },
          offset: { type: "number", description: "Pagination offset" },
        },
      },
    },
    run: async (args, client) => {
      const params = new URLSearchParams();
      if (args["channel"]) params.set("channel", String(args["channel"]));
      if (args["limit"]) params.set("limit", String(args["limit"]));
      if (args["offset"]) params.set("offset", String(args["offset"]));
      const result = await client.request<unknown>(
        "GET",
        `/v1/templates?${params}`,
      );
      return JSON.stringify(result, null, 2);
    },
  },
  {
    tool: {
      name: "engage_create_template",
      description:
        "Create a reusable message template. Supports Handlebars variables like {{firstName}}, {{rankingPosition}}.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Template name" },
          channel: {
            type: "string",
            enum: ["email", "sms", "push", "whatsapp", "voice"],
            description: "Target channel",
          },
          body: {
            type: "string",
            description: "Template body text (Handlebars variables supported)",
          },
          subject: {
            type: "string",
            description: "Email subject line (required for email channel)",
          },
          bodyHtml: {
            type: "string",
            description: "HTML body for email templates (optional)",
          },
        },
        required: ["name", "channel", "body"],
      },
    },
    run: async (args, client) => {
      const template = await client.request<unknown>(
        "POST",
        "/v1/templates",
        args,
      );
      return JSON.stringify(template, null, 2);
    },
  },
  {
    tool: {
      name: "engage_get_template",
      description: "Get a template by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Template ID" },
        },
        required: ["id"],
      },
    },
    run: async (args, client) => {
      const template = await client.request<unknown>(
        "GET",
        `/v1/templates/${args["id"]}`,
      );
      return JSON.stringify(template, null, 2);
    },
  },
];
