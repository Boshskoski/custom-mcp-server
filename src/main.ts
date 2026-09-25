import { existsSync } from "node:fs";
import readline from "node:readline/promises";
import Anthropic from "@anthropic-ai/sdk";
import { MCPClient } from "./mcp-client.js";

if (existsSync(".env")) process.loadEnvFile(".env");

const anthropic = new Anthropic();
const MODEL = "claude-opus-5";

async function main() {
  const mcp = new MCPClient("npx", ["tsx", "src/index.ts"]);
  await mcp.connect();

  const mcpTools = await mcp.listTools();
  const tools: Anthropic.Tool[] = mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));

  const docIds = (await mcp.readResource("docs://documents")) as string[];
  const prompts = await mcp.listPrompts();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(
    "Connected. Ask about a document, use @doc_id to attach one, or /prompt_name arg to run a prompt (Ctrl+C to quit)."
  );

  while (true) {
    const question = await rl.question("\nYou: ");
    if (!question.trim()) continue;

    let messages: Anthropic.MessageParam[];

    if (question.startsWith("/")) {
      const [commandName, ...argValues] = question.slice(1).trim().split(/\s+/);
      const prompt = prompts.find((p) => p.name === commandName);
      if (!prompt) {
        console.log(`\nUnknown prompt: ${commandName}`);
        continue;
      }
      const argNames = prompt.arguments?.map((a) => a.name) ?? [];
      const args = Object.fromEntries(argNames.map((name, i) => [name, argValues[i] ?? ""]));
      const promptMessages = await mcp.getPrompt(commandName, args);
      messages = promptMessages.map((m) => ({
        role: m.role,
        content: m.content.type === "text" ? m.content.text : "",
      }));
    } else {
      const mentionedIds = [...question.matchAll(/@([\w.-]+)/g)]
        .map((match) => match[1])
        .filter((id) => docIds.includes(id));

      let userContent = question;
      if (mentionedIds.length > 0) {
        const attachments = await Promise.all(
          mentionedIds.map(async (id) => {
            const content = await mcp.readResource(`docs://documents/${id}`);
            return `<document id="${id}">\n${content}\n</document>`;
          })
        );
        userContent = `${attachments.join("\n\n")}\n\n${question}`;
      }

      messages = [{ role: "user", content: userContent }];
    }

    while (true) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 16000,
        tools,
        messages,
      });

      for (const block of response.content) {
        if (block.type === "text") {
          console.log(`\nClaude: ${block.text}`);
        }
      }

      if (response.stop_reason === "end_turn") break;

      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );
      if (toolUseBlocks.length === 0) break;

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        console.log(`\n[calling tool ${toolUse.name} with ${JSON.stringify(toolUse.input)}]`);
        const result = await mcp.callTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.content as Anthropic.ToolResultBlockParam["content"],
          is_error: result.isError === true,
        });
      }
      messages.push({ role: "user", content: toolResults });
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
