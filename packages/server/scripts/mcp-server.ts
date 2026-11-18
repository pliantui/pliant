import { readFileSync } from "node:fs"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
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

// The tools arrive as JSON Schema, which only the low-level server accepts.
// eslint-disable-next-line @typescript-eslint/no-deprecated
const server = new Server(
  { name: "pliant", version: "0.0.0" },
  { capabilities: { tools: {} } }
)
server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }))
server.setRequestHandler(CallToolRequestSchema, () => ({
  content: [{ type: "text", text: "ok" }],
}))
await server.connect(new StdioServerTransport())
