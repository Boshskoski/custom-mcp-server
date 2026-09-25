import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { docs } from "./docs.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "DocumentMCP",
    version: "1.0.0",
  });

  server.registerTool(
    "read_doc_contents",
    {
      description: "Read the contents of a document and return it as a string.",
      inputSchema: {
        doc_id: z.string().describe("Id of the document to read"),
      },
    },
    async ({ doc_id }) => {
      if (!(doc_id in docs)) {
        throw new Error(`Doc with id ${doc_id} not found`);
      }
      return {
        content: [{ type: "text", text: docs[doc_id] }],
      };
    }
  );

  server.registerTool(
    "edit_document",
    {
      description: "Edit a document by replacing a string in the document's content with a new string.",
      inputSchema: {
        doc_id: z.string().describe("Id of the document that will be edited"),
        old_str: z.string().describe("The text to replace. Must match exactly, including whitespace."),
        new_str: z.string().describe("The new text to insert in place of the old text."),
      },
    },
    async ({ doc_id, old_str, new_str }) => {
      if (!(doc_id in docs)) {
        throw new Error(`Doc with id ${doc_id} not found`);
      }
      docs[doc_id] = docs[doc_id].replace(old_str, new_str);
      return {
        content: [{ type: "text", text: `Updated ${doc_id}` }],
      };
    }
  );

  server.registerResource(
    "list_docs",
    "docs://documents",
    { mimeType: "application/json" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(Object.keys(docs)),
        },
      ],
    })
  );

  server.registerResource(
    "fetch_doc",
    new ResourceTemplate("docs://documents/{doc_id}", {
      list: async () => ({
        resources: Object.keys(docs).map((id) => ({
          uri: `docs://documents/${id}`,
          name: id,
          mimeType: "text/plain",
        })),
      }),
    }),
    { mimeType: "text/plain" },
    async (uri, { doc_id }) => {
      if (typeof doc_id !== "string" || !(doc_id in docs)) {
        throw new Error(`Doc with id ${doc_id} not found`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: docs[doc_id],
          },
        ],
      };
    }
  );

  server.registerPrompt(
    "format",
    {
      description: "Rewrites the contents of the document in Markdown format.",
      argsSchema: {
        doc_id: z.string().describe("Id of the document to format"),
      },
    },
    ({ doc_id }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Your goal is to reformat a document to be written with markdown syntax.

The id of the document you need to reformat is:
<document_id>
${doc_id}
</document_id>

Add in headers, bullet points, tables, etc as necessary. Feel free to add in structure.
Use the 'edit_document' tool to edit the document. After the document has been reformatted, respond only with the final version of the document. Do not add explanations of your changes.`,
          },
        },
      ],
    })
  );

  return server;
}
