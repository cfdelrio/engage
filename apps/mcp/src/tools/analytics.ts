import type { ToolDef } from "../types.js";

const CHANNEL_ENDPOINTS: Record<string, string> = {
  email: "email-campaigns",
  sms: "sms-campaigns",
  whatsapp: "whatsapp-campaigns",
  push: "push-campaigns",
};

export const analyticsTools: ToolDef[] = [
  {
    tool: {
      name: "engage_get_campaign_metrics",
      description:
        "Get delivery and engagement metrics for a campaign: sent, delivered, opened/read, failed, and rates.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Campaign ID" },
          channel: {
            type: "string",
            enum: ["email", "sms", "whatsapp", "push"],
            description: "Campaign channel",
          },
          since: {
            type: "string",
            description:
              "Start date ISO 8601 (defaults to last 24h). Example: 2024-01-01T00:00:00Z",
          },
          granularity: {
            type: "string",
            enum: ["hour", "day", "week"],
            description: "Timeline granularity (default: hour)",
          },
        },
        required: ["id", "channel"],
      },
    },
    run: async (args, client) => {
      const endpoint = CHANNEL_ENDPOINTS[String(args["channel"])];
      if (!endpoint) throw new Error(`Unknown channel: ${args["channel"]}`);
      const params = new URLSearchParams();
      if (args["since"]) params.set("since", String(args["since"]));
      if (args["granularity"])
        params.set("granularity", String(args["granularity"]));
      const qs = params.toString();
      const result = await client.request<unknown>(
        "GET",
        `/v1/${endpoint}/${args["id"]}${qs ? `?${qs}` : ""}`,
      );
      return JSON.stringify(result, null, 2);
    },
  },
];
