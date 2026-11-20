import type { LanguageModelMiddleware } from "ai"
import * as z from "zod"

import { MissingRecordingError } from "./missing-recording-error"

type WrapGenerate = NonNullable<LanguageModelMiddleware["wrapGenerate"]>
type GenerateResult = Awaited<ReturnType<WrapGenerate>>
type CallOptions = Parameters<WrapGenerate>[0]["params"]

/**
 * Where model answers are recorded and replayed from. `record` calls the model
 * and writes each answer to `directory`. `replay` serves answers from
 * `directory`, or from `recordings` (the parsed contents of recording files),
 * and never calls the model. Replaying from `recordings` uses only Web APIs, so
 * it also runs without a file system, such as on Cloudflare Workers.
 *
 * @experimental
 */
export type RecordingOptions =
  | { mode: "record" | "replay"; directory: string; recordings?: never }
  | { mode: "replay"; recordings: readonly unknown[]; directory?: never }

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
async function recordingKey(
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
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(input))
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
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

type Recording = z.infer<typeof recordingSchema>

function fromRecording({
  key,
  source,
  standIn,
  result,
}: Recording): GenerateResult {
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

// The Node.js modules are imported on use, so replaying from `recordings`
// doesn't need them.
async function recordingFile(directory: string, key: string) {
  const path = await import("node:path")
  return path.join(directory, `${key}.json`)
}

async function readRecording(directory: string, key: string) {
  const fs = await import("node:fs/promises")
  let text: string
  try {
    text = await fs.readFile(await recordingFile(directory, key), "utf8")
  } catch (error) {
    throw isMissing(error) ? new MissingRecordingError(key) : error
  }
  return recordingSchema.parse(JSON.parse(text))
}

async function writeRecording(directory: string, key: string, text: string) {
  const fs = await import("node:fs/promises")
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(await recordingFile(directory, key), text)
}

function replayFrom(recordings: readonly unknown[]): LanguageModelMiddleware {
  const byKey = new Map<string, Recording>()
  recordings.forEach((recording, index) => {
    const parsed = recordingSchema.safeParse(recording)
    if (!parsed.success) {
      throw new Error(`recordings[${String(index)}] is not a valid recording`, {
        cause: parsed.error,
      })
    }
    if (byKey.has(parsed.data.key)) {
      throw new Error(`Two recordings have the key ${parsed.data.key}`)
    }
    byKey.set(parsed.data.key, parsed.data)
  })
  return {
    specificationVersion: "v4",
    wrapGenerate: async ({ params, model }) => {
      const key = await recordingKey(model, params)
      const recording = byKey.get(key)
      if (!recording) {
        throw new MissingRecordingError(key)
      }
      return fromRecording(recording)
    },
  }
}

/**
 * Records model answers to JSON files keyed by a hash of the model, the prompt
 * and the tools, or replays them without calling the model, following the AI
 * SDK's caching middleware pattern. For development, tests and demos.
 * Recording and replaying from `directory` need Node.js, and recording writes
 * every ask to disk. `recordings` are checked against the recording format
 * when the middleware is created, so an invalid one throws then.
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
  // The types rule this out; JavaScript callers get the same check.
  const given: { mode: string; directory?: unknown; recordings?: unknown } =
    options
  if (
    given.recordings !== undefined &&
    (given.mode !== "replay" || given.directory !== undefined)
  ) {
    throw new TypeError(
      'Pass recordings only in mode "replay", and without a directory'
    )
  }
  const { mode, directory, recordings } = options
  if (recordings !== undefined) {
    return replayFrom(recordings)
  }
  return {
    specificationVersion: "v4",
    wrapGenerate: async ({ doGenerate, params, model }) => {
      const key = await recordingKey(model, params)
      if (mode === "replay") {
        return fromRecording(await readRecording(directory, key))
      }
      const result = await doGenerate()
      await writeRecording(
        directory,
        key,
        `${JSON.stringify(toRecording(key, model, result, new Date()), null, 2)}\n`
      )
      return result
    },
  }
}
