import {
  generateText,
  tool,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai"
import * as z from "zod"

import type { Op } from "@pliantui/contract"
import { formatError, validateOverlay } from "@pliantui/core"

import type { AskRequest } from "./ask-request"
import type { AskResponse } from "./ask-response"
import { createOpTools, type OpTool } from "./op-tools"
import { outOfScopeMessage } from "./out-of-scope"
import { instructions, repairMessage, userMessage } from "./prompt"

const unsupportedMessage = "That can't be changed here."

const failedMessage = "Couldn't find a valid change for that ask."

export interface AnswerOptions {
  model: LanguageModel
  user: string
  coreVersion: string
  now: () => Date
  generateId: () => string
  maxToolCalls: number
  timeout: number
  signal: AbortSignal
}

interface ToolCall {
  toolName: string
  input: unknown
}

type Attempt =
  { done: true; response: AskResponse } | { done: false; error: string }

const clarifySchema = z.strictObject({ question: z.string().min(1).max(200) })

const unavailableSchema = z.strictObject({
  reason: z.enum(["unsupported", "out-of-scope"]),
})

const metaTools: Pick<OpTool, "name" | "description" | "inputSchema">[] = [
  {
    name: "clarify",
    description: "Ask the user one short question when the ask is ambiguous.",
    inputSchema: clarifySchema,
  },
  {
    name: "unavailable",
    description:
      "Say the ask can't be done here: out-of-scope for asks that change data, unsupported when no tool fits.",
    inputSchema: unavailableSchema,
  },
]

function toolSet(tools: readonly OpTool[]) {
  const set: ToolSet = {}
  for (const { name, description, inputSchema } of [...tools, ...metaTools]) {
    set[name] = tool({ description, inputSchema })
  }
  return set
}

function metaAnswer(calls: readonly ToolCall[]): AskResponse | undefined {
  for (const { toolName, input } of calls) {
    if (toolName === "clarify") {
      const parsed = clarifySchema.safeParse(input)
      if (parsed.success) {
        return { status: "clarify", question: parsed.data.question }
      }
    }
  }
  if (calls.every(({ toolName }) => toolName === "unavailable")) {
    for (const { input } of calls) {
      const parsed = unavailableSchema.safeParse(input)
      if (parsed.success) {
        return {
          status: "unavailable",
          reason:
            parsed.data.reason === "out-of-scope"
              ? outOfScopeMessage
              : unsupportedMessage,
        }
      }
    }
  }
  return undefined
}

function interpret(
  ask: AskRequest,
  calls: readonly ToolCall[],
  tools: readonly OpTool[],
  options: AnswerOptions
): Attempt {
  if (calls.length === 0) {
    return { done: false, error: "No tool was called." }
  }
  const meta = metaAnswer(calls)
  if (meta) {
    return { done: true, response: meta }
  }
  if (calls.length > options.maxToolCalls) {
    return {
      done: false,
      error: `Make at most ${String(options.maxToolCalls)} tool calls.`,
    }
  }
  const ops: Op[] = []
  const explain: string[] = []
  const errors: string[] = []
  for (const [index, { toolName, input }] of calls.entries()) {
    const opTool = tools.find(({ name }) => name === toolName)
    if (!opTool) {
      errors.push(
        `calls[${String(index)}]: ${toolName} can't be combined with changes`
      )
      continue
    }
    const expansion = opTool.expand(input)
    if (expansion.success) {
      ops.push(...expansion.ops)
      explain.push(...expansion.explain)
    } else {
      errors.push(`calls[${String(index)}] (${toolName}): ${expansion.error}`)
    }
  }
  if (errors.length > 0) {
    return { done: false, error: errors.join("\n") }
  }
  const now = options.now()
  // Previews live in the session layer. Resolution against the lower layers
  // (`validateOverlay(overlay, { layers })`) slots in here once core has it.
  const result = validateOverlay({
    v: 1,
    id: options.generateId(),
    surface: ask.surface,
    layer: "session",
    ops,
    basis: {
      contract: 1,
      core: options.coreVersion,
      manifests: { [ask.context.manifest.kind]: ask.context.manifest.version },
    },
    source: "ai",
    explain,
    createdBy: options.user,
    createdAt: now.toISOString(),
  })
  if (!result.success) {
    return {
      done: false,
      error: `The calls expanded to these ops:\n${JSON.stringify(ops)}\n${formatError(result.error)}`,
    }
  }
  return {
    done: true,
    response: {
      status: "ok",
      overlay: result.data,
      explain: [...new Set(explain)],
    },
  }
}

/**
 * Asks the model for ops, validates them, and repairs once with the errors
 * before failing plainly.
 */
export async function answerAsk(
  ask: AskRequest,
  options: AnswerOptions
): Promise<AskResponse> {
  const tools = createOpTools(ask.target, ask.context)
  if (tools.length === 0) {
    return { status: "unavailable", reason: unsupportedMessage }
  }
  const messages: ModelMessage[] = [{ role: "user", content: userMessage(ask) }]
  for (let attempt = 0; attempt < 2; attempt++) {
    const { toolCalls } = await generateText({
      model: options.model,
      instructions,
      messages,
      tools: toolSet(tools),
      toolChoice: "auto",
      maxOutputTokens: 4096,
      maxRetries: 1,
      timeout: options.timeout,
      abortSignal: options.signal,
    })
    const calls = toolCalls.map(({ toolName, input }): ToolCall => ({
      toolName,
      input,
    }))
    const result = interpret(ask, calls, tools, options)
    if (result.done) {
      return result.response
    }
    // The repair restates the rejected calls in a user message instead of
    // replaying them with tool results, so it reads the same to every
    // provider and needs no tool-result protocol for calls never run.
    messages.push({
      role: "user",
      content: repairMessage(
        calls.map(({ toolName, input }) => ({ tool: toolName, input })),
        result.error
      ),
    })
  }
  return { status: "error", message: failedMessage }
}
