import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { EngageClient } from "./client.js";

export interface ToolDef {
  tool: Tool;
  run: (args: Record<string, unknown>, client: EngageClient) => Promise<string>;
}
