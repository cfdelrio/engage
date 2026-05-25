import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { EngageClient } from "./client.js";
import { userTools } from "./tools/users.js";
import { campaignTools } from "./tools/campaigns.js";
import { templateTools } from "./tools/templates.js";
import { eventTools } from "./tools/events.js";
import { analyticsTools } from "./tools/analytics.js";
import type { ToolDef } from "./types.js";

const apiUrl = process.env["ENGAGE_API_URL"] ?? "http://localhost:3001";
const apiKey = process.env["ENGAGE_API_KEY"] ?? "";

if (!apiKey) {
  process.stderr.write("[engage-mcp] WARNING: ENGAGE_API_KEY is not set\n");
}

const client = new EngageClient(apiUrl, apiKey);

const allTools: ToolDef[] = [
  ...userTools,
  ...campaignTools,
  ...templateTools,
  ...eventTools,
  ...analyticsTools,
];

const toolMap = new Map(allTools.map((t) => [t.tool.name, t]));

const server = new Server(
  { name: "engage", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools.map((t) => t.tool),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const toolDef = toolMap.get(name);

  if (!toolDef) {
    return {
      content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const text = await toolDef.run(args ?? {}, client);
    return { content: [{ type: "text" as const, text }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
