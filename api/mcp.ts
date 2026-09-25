import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../src/server-factory.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  const parsedBody = (req as IncomingMessage & { body?: unknown }).body;
  await transport.handleRequest(req, res, parsedBody);
}
