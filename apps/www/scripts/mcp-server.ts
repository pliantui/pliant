import { readFileSync } from "node:fs"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js"

// Serves the tools the handler built for one call, with the same names,
// descriptions and JSON schemas, so `claude -p` sees what the API would.
const [, , file] = process.argv
if (file === undefined) {
  throw new Error("Pass the path of a JSON file with the tools")
}
const tools = JSON.parse(readFileSync(file, "utf8")) as Tool[]

const { server } = new McpServer(
  { name: "pliant", version: "0.0.0" },
  { capabilities: { tools: {} } }
)
// The tools arrive as JSON Schema, which `registerTool` doesn't take, so they
// are served through the underlying server's handlers.
server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }))
server.setRequestHandler(CallToolRequestSchema, () => ({
  content: [{ type: "text", text: "ok" }],
}))
await server.connect(new StdioServerTransport())
