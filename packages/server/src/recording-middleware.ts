import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { LanguageModelMiddleware } from "ai"
import * as z from "zod"

import { MissingRecordingError } from "./missing-recording-error"

type WrapGenerate = NonNullable<LanguageModelMiddleware["wrapGenerate"]>
type GenerateResult = Awaited<ReturnType<WrapGenerate>>
type CallOptions = Parameters<WrapGenerate>[0]["params"]

/**
 * Where model answers are recorded and replayed from. `record` calls the model
 * and writes each answer to `directory`. `replay` serves answers from
 * `directory`, or from `recordings` (the parsed recording files keyed by their
 * `key`), and never calls the model. Replaying from `recordings` never reads
 * the file system, so it also runs where there is none, such as Cloudflare
 * Workers with the `nodejs_compat` flag.
 *
 * @experimental
 */
export type RecordingOptions =
  | { mode: "record" | "replay"; directory: string; recordings?: never }
  | {
      mode: "replay"
      recordings: Readonly<Record<string, unknown>>
      directory?: never
    }

const contentSchema = z.union([
  z.looseObject({
    type: z.literal("tool-call"),
    toolCallId: z.string(),
    toolName: z.string(),
    input: z.string(),
  }),
  z.looseObject({ type: z.literal("text"), text: z.string() }),
  z.looseObject({
    type: z.string().refine((type) => type !== "tool-call" && type !== "text"),
  }),
])

const recordingSchema = z.looseObject({
  key: z.string(),
  source: z.string().optional(),
  standIn: z.boolean().optional(),
  result: z.looseObject({
    content: z.array(contentSchema),
    finishReason: z.looseObject({ unified: z.string() }),
    usage: z.looseObject({}),
    warnings: z.array(z.unknown()),
    response: z.looseObject({ timestamp: z.string().optional() }).optional(),
  }),
})

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical)
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonical(entry)])
    )
  }
  return value
}

/**
 * A stable hash of what decides the answer: the model, the prompt (system and
 * messages) and the tools.
 */
function recordingKey(
  model: { provider: string; modelId: string },
  { prompt, tools, toolChoice }: CallOptions
) {
  const input = canonical({
    provider: model.provider,
    modelId: model.modelId,
    prompt,
    tools,
    toolChoice,
  })
  return createHash("sha256").update(JSON.stringify(input)).digest("hex")
}

// A model can describe where its answers come from under
// `providerMetadata.recording`, for example that it stands in for the API.
// That provenance goes to the top of the file, not into the replayed answer.
function toRecording(
  key: string,
  model: { provider: string; modelId: string },
  result: GenerateResult,
  recordedAt: Date
) {
  const { content, finishReason, usage, warnings, response } = result
  const { recording, ...providerMetadata } = result.providerMetadata ?? {}
  return {
    key,
    provider: model.provider,
    modelId: model.modelId,
    recordedAt: recordedAt.toISOString(),
    ...recording,
    result: {
      content,
      finishReason,
      usage,
      warnings,
      ...(Object.keys(providerMetadata).length > 0 ? { providerMetadata } : {}),
      ...(response && {
        response: {
          id: response.id,
          modelId: response.modelId,
          timestamp: response.timestamp,
        },
      }),
    },
  }
}

const warned = new Set<string>()

function fromRecording(recording: unknown): GenerateResult {
  const { key, source, standIn, result } = recordingSchema.parse(recording)
  if (standIn === true && !warned.has(key)) {
    warned.add(key)
    console.warn(
      `[pliant] Replaying a stand-in recording from ${source ?? "an unknown source"} (${key}). It is not production evidence.`
    )
  }
  const timestamp = result.response?.timestamp
  // The schema checks the tool calls and text the pipeline reads; the other
  // parts and fields are the provider's own output, written by `toRecording`.
  const replayed = result as unknown as GenerateResult
  return timestamp === undefined
    ? replayed
    : {
        ...replayed,
        response: { ...replayed.response, timestamp: new Date(timestamp) },
      }
}

function isMissing(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

async function readRecording(directory: string, key: string) {
  let text: string
  try {
    text = await readFile(join(directory, `${key}.json`), "utf8")
  } catch (error) {
    throw isMissing(error) ? new MissingRecordingError(key) : error
  }
  const recording: unknown = JSON.parse(text)
  return recording
}

/**
 * Records model answers to JSON files keyed by a hash of the model, the prompt
 * and the tools, or replays them without calling the model, following the AI
 * SDK's caching middleware pattern. For development, tests and demos: it
 * imports `node:crypto` and `node:fs`, and recording writes every ask to disk.
 *
 * ```ts
 * const model = wrapLanguageModel({
 *   model: anthropic("claude-haiku-5-5"),
 *   middleware: recordingMiddleware({ mode: "replay", directory: "recordings" }),
 * })
 * ```
 *
 * @experimental
 */
export function recordingMiddleware(
  options: RecordingOptions
): LanguageModelMiddleware {
  return {
    specificationVersion: "v4",
    wrapGenerate: async ({ doGenerate, params, model }) => {
      const key = recordingKey(model, params)
      const { recordings } = options
      if (recordings !== undefined) {
        if (!Object.hasOwn(recordings, key)) {
          throw new MissingRecordingError(key)
        }
        return fromRecording(recordings[key])
      }
      const { mode, directory } = options
      if (mode === "replay") {
        return fromRecording(await readRecording(directory, key))
      }
      const result = await doGenerate()
      await mkdir(directory, { recursive: true })
      await writeFile(
        join(directory, `${key}.json`),
        `${JSON.stringify(toRecording(key, model, result, new Date()), null, 2)}\n`
      )
      return result
    },
  }
}
