import type { ToolDef } from "../types.js";

export const userTools: ToolDef[] = [
  {
    tool: {
      name: "engage_get_user",
      description:
        "Get a user by internal ID, externalId, or email. Use externalId when looking up by the ID from an external system (e.g. prode userId).",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Internal Engage user ID (UUID)" },
          externalId: {
            type: "string",
            description: "External user ID from the source system",
          },
          email: { type: "string", description: "User email address" },
        },
      },
    },
    run: async (args, client) => {
      if (args["id"]) {
        const user = await client.request<unknown>(
          "GET",
          `/v1/users/${args["id"]}`,
        );
        return JSON.stringify(user, null, 2);
      }
      const params = new URLSearchParams();
      if (args["externalId"])
        params.set("externalId", String(args["externalId"]));
      if (args["email"]) params.set("email", String(args["email"]));
      if (!params.toString())
        throw new Error("Provide at least one of: id, externalId, email");
      const result = await client.request<unknown>(
        "GET",
        `/v1/users?${params}`,
      );
      return JSON.stringify(result, null, 2);
    },
  },
  {
    tool: {
      name: "engage_create_user",
      description:
        "Create or update a user (upsert by externalId). Updates email, phone, tags, and metadata if user already exists.",
      inputSchema: {
        type: "object",
        properties: {
          externalId: {
            type: "string",
            description: "External user ID (required)",
          },
          email: { type: "string", description: "Email address" },
          phone: {
            type: "string",
            description: "Phone number in E.164 format (e.g. +5491155996222)",
          },
          timezone: {
            type: "string",
            description: "IANA timezone (e.g. America/Buenos_Aires)",
          },
          locale: { type: "string", description: "Locale code (e.g. es-AR)" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "User tags for segmentation",
          },
          metadata: {
            type: "object",
            description:
              "Arbitrary key-value metadata (e.g. whatsapp_consent, sms_consent, nombre)",
          },
        },
        required: ["externalId"],
      },
    },
    run: async (args, client) => {
      const user = await client.request<unknown>("POST", "/v1/users", args);
      return JSON.stringify(user, null, 2);
    },
  },
  {
    tool: {
      name: "engage_list_users",
      description: "List users with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          externalId: {
            type: "string",
            description: "Filter by externalId (partial, case-insensitive)",
          },
          email: {
            type: "string",
            description: "Filter by email (partial, case-insensitive)",
          },
          tags: {
            type: "string",
            description: "Comma-separated tags to filter by (any match)",
          },
          limit: {
            type: "number",
            description: "Max results per page (default 50, max 200)",
          },
          cursor: {
            type: "string",
            description:
              "Pagination cursor from a previous response's nextCursor",
          },
        },
      },
    },
    run: async (args, client) => {
      const params = new URLSearchParams();
      if (args["externalId"])
        params.set("externalId", String(args["externalId"]));
      if (args["email"]) params.set("email", String(args["email"]));
      if (args["tags"]) params.set("tags", String(args["tags"]));
      if (args["limit"]) params.set("limit", String(args["limit"]));
      if (args["cursor"]) params.set("cursor", String(args["cursor"]));
      const result = await client.request<unknown>(
        "GET",
        `/v1/users?${params}`,
      );
      return JSON.stringify(result, null, 2);
    },
  },
];
