import type { ToolDef } from "../types.js";

const CHANNEL_ENDPOINTS: Record<string, string> = {
  email: "email-campaigns",
  sms: "sms-campaigns",
  whatsapp: "whatsapp-campaigns",
  push: "push-campaigns",
  voice: "voice-campaigns",
};

function endpoint(channel: unknown): string {
  const ep = CHANNEL_ENDPOINTS[String(channel)];
  if (!ep)
    throw new Error(
      `Unknown channel: ${channel}. Valid: email, sms, whatsapp, push, voice`,
    );
  return ep;
}

export const campaignTools: ToolDef[] = [
  {
    tool: {
      name: "engage_list_campaigns",
      description:
        "List campaigns for a channel, optionally filtered by status",
      inputSchema: {
        type: "object",
        properties: {
          channel: {
            type: "string",
            enum: ["email", "sms", "whatsapp", "push", "voice"],
            description: "Channel to query",
          },
          status: {
            type: "string",
            description: "Filter by status: draft, active, paused, completed",
          },
          limit: { type: "number", description: "Max results (default 50)" },
          offset: { type: "number", description: "Pagination offset" },
        },
        required: ["channel"],
      },
    },
    run: async (args, client) => {
      const ep = endpoint(args["channel"]);
      const params = new URLSearchParams();
      if (args["status"]) params.set("status", String(args["status"]));
      if (args["limit"]) params.set("limit", String(args["limit"]));
      if (args["offset"]) params.set("offset", String(args["offset"]));
      const qs = params.toString();
      const result = await client.request<unknown>(
        "GET",
        `/v1/${ep}${qs ? `?${qs}` : ""}`,
      );
      return JSON.stringify(result, null, 2);
    },
  },
  {
    tool: {
      name: "engage_create_campaign",
      description:
        "Create a campaign. Email needs subject+bodyHtml (or templateId). SMS/WhatsApp needs body. Push needs title+body.",
      inputSchema: {
        type: "object",
        properties: {
          channel: {
            type: "string",
            enum: ["email", "sms", "whatsapp", "push"],
            description: "Target channel",
          },
          name: { type: "string", description: "Campaign name" },
          description: { type: "string", description: "Optional description" },
          // email
          subject: { type: "string", description: "(email) Subject line" },
          bodyHtml: { type: "string", description: "(email) HTML body" },
          bodyText: { type: "string", description: "(email) Plain-text body" },
          fromName: { type: "string", description: "(email) Sender name" },
          fromEmail: { type: "string", description: "(email) Sender email" },
          templateId: {
            type: "string",
            description: "(email) Template ID to use",
          },
          // sms / whatsapp
          body: {
            type: "string",
            description: "(sms/whatsapp/push) Message body",
          },
          // push
          title: { type: "string", description: "(push) Notification title" },
          imageUrl: { type: "string", description: "(push) Image URL" },
          actionUrl: {
            type: "string",
            description: "(push) Action URL on tap",
          },
          priority: {
            type: "string",
            enum: ["high", "normal"],
            description: "(push) Delivery priority",
          },
          // common
          triggerType: {
            type: "string",
            enum: ["manual", "scheduled", "rule-based", "event-based"],
            description: "How the campaign is triggered (default: manual)",
          },
          audienceFilter: {
            type: "object",
            description: "Prisma-style filter to restrict the audience",
          },
          maxRetries: {
            type: "number",
            description: "Max delivery retries (default: 2)",
          },
        },
        required: ["channel", "name"],
      },
    },
    run: async (args, client) => {
      const { channel, ...rest } = args;
      const ep = endpoint(channel);
      const campaign = await client.request<unknown>("POST", `/v1/${ep}`, rest);
      return JSON.stringify(campaign, null, 2);
    },
  },
  {
    tool: {
      name: "engage_get_campaign",
      description: "Get a campaign by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Campaign ID" },
          channel: {
            type: "string",
            enum: ["email", "sms", "whatsapp", "push", "voice"],
            description: "Campaign channel",
          },
        },
        required: ["id", "channel"],
      },
    },
    run: async (args, client) => {
      const ep = endpoint(args["channel"]);
      const campaign = await client.request<unknown>(
        "GET",
        `/v1/${ep}/${args["id"]}`,
      );
      return JSON.stringify(campaign, null, 2);
    },
  },
  {
    tool: {
      name: "engage_start_campaign",
      description:
        "Launch a campaign. Sends to all eligible users and enqueues delivery jobs. Campaign must be in draft or paused status.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Campaign ID" },
          channel: {
            type: "string",
            enum: ["email", "sms", "whatsapp", "push", "voice"],
            description: "Campaign channel",
          },
        },
        required: ["id", "channel"],
      },
    },
    run: async (args, client) => {
      const ep = endpoint(args["channel"]);
      const result = await client.request<unknown>(
        "POST",
        `/v1/${ep}/${args["id"]}/start`,
      );
      return JSON.stringify(result, null, 2);
    },
  },
  {
    tool: {
      name: "engage_pause_campaign",
      description:
        "Pause an active campaign. Campaign must be in active status.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Campaign ID" },
          channel: {
            type: "string",
            enum: ["email", "sms", "whatsapp", "push", "voice"],
            description: "Campaign channel",
          },
        },
        required: ["id", "channel"],
      },
    },
    run: async (args, client) => {
      const ep = endpoint(args["channel"]);
      const result = await client.request<unknown>(
        "POST",
        `/v1/${ep}/${args["id"]}/pause`,
      );
      return JSON.stringify(result, null, 2);
    },
  },
  {
    tool: {
      name: "engage_delete_campaign",
      description: "Delete a campaign. Works on any status.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Campaign ID" },
          channel: {
            type: "string",
            enum: ["email", "sms", "whatsapp", "push", "voice"],
            description: "Campaign channel",
          },
        },
        required: ["id", "channel"],
      },
    },
    run: async (args, client) => {
      const ep = endpoint(args["channel"]);
      await client.request<unknown>("DELETE", `/v1/${ep}/${args["id"]}`);
      return JSON.stringify({ success: true, id: args["id"] });
    },
  },
];
