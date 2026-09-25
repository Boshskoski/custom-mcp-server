import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool, CallToolResult, Prompt, PromptMessage } from "@modelcontextprotocol/sdk/types.js";

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport;

  constructor(command: string, args: string[]) {
    this.client = new Client({ name: "doc-mcp-client", version: "1.0.0" });
    this.transport = new StdioClientTransport({ command, args });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
  }

  async listTools(): Promise<Tool[]> {
    const result = await this.client.listTools();
    return result.tools;
  }

  async callTool(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<CallToolResult> {
    return (await this.client.callTool({
      name: toolName,
      arguments: toolInput,
    })) as CallToolResult;
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  async readResource(uri: string): Promise<unknown> {
    const result = await this.client.readResource({ uri });
    const resource = result.contents[0];
    if (resource && "text" in resource) {
      if (resource.mimeType === "application/json") {
        return JSON.parse(resource.text);
      }
      return resource.text;
    }
    return resource;
  }

  async listPrompts(): Promise<Prompt[]> {
    const result = await this.client.listPrompts();
    return result.prompts;
  }

  async getPrompt(
    promptName: string,
    args: Record<string, string>
  ): Promise<PromptMessage[]> {
    const result = await this.client.getPrompt({ name: promptName, arguments: args });
    return result.messages;
  }
}

async function main() {
  const client = new MCPClient("npx", ["tsx", "src/index.ts"]);
  await client.connect();
  const tools = await client.listTools();
  console.log(JSON.stringify(tools, null, 2));
  await client.close();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
