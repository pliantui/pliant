import { execFileSync, spawn } from "node:child_process"
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { anthropic } from "@ai-sdk/anthropic"
import { wrapLanguageModel } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import * as z from "zod"

import {
  askRequestSchema,
  createPliantHandler,
  type PliantHandlerConfig,
} from "@pliantui/server"
import { recordingMiddleware } from "@pliantui/server/recordings"

// Records the demo asks into `recordings/`: `pnpm --filter www record`. By
// default it records through `claude -p` (headless Claude Code) and marks
// each recording `standIn: true`, because that request path differs from
// the Anthropic API's. `ANTHROPIC_API_KEY=... pnpm --filter www record --api`
// records through the Anthropic API under the same keys.

const args = process.argv.slice(2)
const useApi = args.includes("--api")
const directory = resolve(
  args.find((arg) => !arg.startsWith("--")) ?? "recordings"
)
const mcpServer = fileURLToPath(new URL("mcp-server.ts", import.meta.url))

const demo = z
  .strictObject({
    surface: z.string(),
    targets: z.array(
      z.strictObject({
        target: z.string(),
        context: z.unknown(),
        prompts: z.array(z.string()),
      })
    ),
  })
  .parse(
    JSON.parse(readFileSync(new URL("demo-asks.json", import.meta.url), "utf8"))
  )

const asks = demo.targets.flatMap(({ target, context, prompts }) =>
  prompts.map((prompt) =>
    askRequestSchema.parse({ surface: demo.surface, target, prompt, context })
  )
)

type CallOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0]
type GenerateResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>

const toolUseSchema = z.looseObject({
  type: z.literal("tool_use"),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
})

const textSchema = z.looseObject({ type: z.literal("text"), text: z.string() })

const assistantSchema = z.looseObject({
  type: z.literal("assistant"),
  message: z.looseObject({
    model: z.string(),
    stop_reason: z.string().nullish(),
    content: z.array(z.looseObject({ type: z.string() })),
  }),
})

type AssistantEvent = z.infer<typeof assistantSchema>

const invocations = new Map<string, number>()
let currentAsk = ""

function promptParts({ prompt }: CallOptions) {
  const system = prompt
    .flatMap((message) => (message.role === "system" ? [message.content] : []))
    .join("\n\n")
  const user = prompt
    .flatMap((message) =>
      message.role === "user"
        ? message.content.flatMap((part) =>
            part.type === "text" ? [part.text] : []
          )
        : []
    )
    .join("\n\n")
  return { system, user }
}

function mcpTools({ tools = [] }: CallOptions) {
  return tools.flatMap((tool) =>
    tool.type === "function"
      ? [
          {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          },
        ]
      : []
  )
}

function runClaude(options: CallOptions, workdir: string) {
  const { system, user } = promptParts(options)
  const toolsFile = join(workdir, "tools.json")
  writeFileSync(toolsFile, JSON.stringify(mcpTools(options)))
  const config = {
    mcpServers: {
      pliant: { command: process.execPath, args: [mcpServer, toolsFile] },
    },
  }
  const cliArgs = [
    "-p",
    "--model",
    "claude-haiku-5-5",
    "--output-format",
    "stream-json",
    "--verbose",
    "--system-prompt",
    system,
    "--tools",
    "",
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--no-session-persistence",
    "--max-turns",
    "4",
    `--mcp-config=${JSON.stringify(config)}`,
    "--allowedTools=mcp__pliant",
    user,
  ]
  invocations.set(currentAsk, (invocations.get(currentAsk) ?? 0) + 1)
  return new Promise<AssistantEvent[]>((done, fail) => {
    const child = spawn("claude", cliArgs, {
      cwd: workdir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, MCP_CONNECTION_NONBLOCKING: "false" },
    })
    const turns: AssistantEvent[] = []
    let buffer = ""
    let stderr = ""
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString()
      let end = buffer.indexOf("\n")
      while (end >= 0) {
        const line = buffer.slice(0, end).trim()
        buffer = buffer.slice(end + 1)
        end = buffer.indexOf("\n")
        const assistant = line
          ? assistantSchema.safeParse(JSON.parse(line))
          : undefined
        if (assistant?.success) {
          turns.push(assistant.data)
        }
      }
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on("error", fail)
    child.on("close", (code) => {
      if (turns.length === 0) {
        fail(new Error(`claude -p exited with ${String(code)}: ${stderr}`))
      } else {
        done(turns)
      }
    })
  })
}

// Claude Code may run one tool per turn where the API would return them
// together, so the answer is every tool call across the turns.
function toContent(events: AssistantEvent[]): GenerateResult["content"] {
  return events
    .flatMap(({ message }) => message.content)
    .flatMap((block): GenerateResult["content"] => {
      const toolUse = toolUseSchema.safeParse(block)
      if (toolUse.success) {
        return [
          {
            type: "tool-call",
            toolCallId: toolUse.data.id,
            toolName: toolUse.data.name.replace(/^mcp__pliant__/, ""),
            input: JSON.stringify(toolUse.data.input),
          },
        ]
      }
      const text = textSchema.safeParse(block)
      return text.success ? [{ type: "text", text: text.data.text }] : []
    })
}

function claudeCodeModel(cliVersion: string) {
  const target = anthropic("claude-haiku-5-5")
  return new MockLanguageModelV4({
    provider: target.provider,
    modelId: target.modelId,
    doGenerate: async (options): Promise<GenerateResult> => {
      const workdir = mkdtempSync(join(tmpdir(), "pliant-record-"))
      try {
        const events = await runClaude(options, workdir)
        const content = toContent(events)
        const last = events.at(-1)?.message
        return {
          content,
          finishReason: {
            unified: content.some(({ type }) => type === "tool-call")
              ? "tool-calls"
              : "stop",
            raw: last?.stop_reason ?? undefined,
          },
          // Claude Code's own prompt and cache make its token counts
          // meaningless for the API path, so they aren't recorded.
          usage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
          warnings: [],
          providerMetadata: {
            recording: {
              source: "claude -p (headless Claude Code)",
              model: last?.model ?? "unknown",
              standIn: true,
              note: "recorded through claude -p (headless Claude Code), not the Anthropic API",
              cliVersion,
            },
          },
        }
      } finally {
        rmSync(workdir, { recursive: true, force: true })
      }
    },
  })
}

function model(): PliantHandlerConfig["model"] {
  if (!useApi) {
    return claudeCodeModel(
      execFileSync("claude", ["--version"]).toString().trim()
    )
  }
  // `record` runs outside turbo, so turbo never caches on this variable.
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (!process.env["ANTHROPIC_API_KEY"]) {
    throw new Error("Set ANTHROPIC_API_KEY to record through the API")
  }
  return anthropic("claude-haiku-5-5")
}

// The demo route replays from this module rather than reading the directory,
// because Cloudflare Workers have no file system.
function writeRecordingsIndex(directory: string) {
  const keys = readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .sort()
  const names = keys.map((_, index) => `recording${String(index)}`)
  const imports = keys.map(
    (key, index) => `import recording${String(index)} from "./${key}.json"\n`
  )
  const file = join(directory, "index.ts")
  writeFileSync(
    file,
    [
      "// Generated by `pnpm --filter www record`. Don't edit it by hand.\n\n",
      ...imports,
      `\nexport const recordings = [${names.join(", ")}]\n`,
    ].join("")
  )
  execFileSync("pnpm", [
    "--workspace-root",
    "exec",
    "prettier",
    "--write",
    file,
  ])
}

const handler = createPliantHandler({
  model: wrapLanguageModel({
    model: model(),
    middleware: recordingMiddleware({ mode: "record", directory }),
  }),
  getUser: () => "anonymous",
  timeout: 120_000,
})

for (const ask of asks) {
  currentAsk = `${ask.target}: ${ask.prompt}`
  const response = await handler(
    new Request("http://localhost/api/pliant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ask),
    })
  )
  const body: unknown = await response.json()
  console.log(`${currentAsk}\n${JSON.stringify(body)}\n`)
}

if (!useApi) {
  const total = [...invocations.values()].reduce((sum, n) => sum + n, 0)
  console.log(`claude -p invocations: ${String(total)}`)
  for (const [ask, n] of invocations) {
    console.log(`  ${String(n)}  ${ask}`)
  }
}
writeRecordingsIndex(directory)
console.log(`Recorded to ${directory}`)
