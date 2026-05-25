import type { ToolDef } from "../types.js";

export const eventTools: ToolDef[] = [
  {
    tool: {
      name: "engage_send_event",
      description:
        "Ingest a custom event for a user. This triggers rule evaluation and can dispatch campaigns (email, SMS, push, WhatsApp, voice).",
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description:
              "Event type (e.g. user.purchase, prode.ranking.changed, match.goal_scored)",
          },
          userId: {
            type: "string",
            description: "External user ID from the source system",
          },
          payload: {
            type: "object",
            description: "Event payload data (business context)",
          },
          metadata: {
            type: "object",
            description:
              "User contact metadata: { user_contact: { email, phone, whatsapp_consent } }",
          },
          idempotencyKey: {
            type: "string",
            description:
              "Unique key to prevent duplicate event processing (recommended)",
          },
        },
        required: ["type", "userId"],
      },
    },
    run: async (args, client) => {
      const result = await client.request<unknown>("POST", "/v1/events", args);
      return JSON.stringify(result, null, 2);
    },
  },
  {
    tool: {
      name: "engage_list_events",
      description:
        "Query historical events. Useful for debugging rule triggers and checking what events a user generated.",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", description: "Filter by event type" },
          userId: { type: "string", description: "Filter by external user ID" },
          from: {
            type: "string",
            description: "Start date ISO 8601 (e.g. 2024-01-01T00:00:00Z)",
          },
          to: { type: "string", description: "End date ISO 8601" },
          limit: {
            type: "number",
            description: "Max results (default 50, max 200)",
          },
          cursor: { type: "string", description: "Pagination cursor" },
        },
      },
    },
    run: async (args, client) => {
      const params = new URLSearchParams();
      if (args["type"]) params.set("type", String(args["type"]));
      if (args["userId"]) params.set("userId", String(args["userId"]));
      if (args["from"]) params.set("from", String(args["from"]));
      if (args["to"]) params.set("to", String(args["to"]));
      if (args["limit"]) params.set("limit", String(args["limit"]));
      if (args["cursor"]) params.set("cursor", String(args["cursor"]));
      const result = await client.request<unknown>(
        "GET",
        `/v1/events?${params}`,
      );
      return JSON.stringify(result, null, 2);
    },
  },
];
