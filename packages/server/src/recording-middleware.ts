import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { LanguageModelMiddleware } from "ai"
import * as z from "zod"

type WrapGenerate = NonNullable<LanguageModelMiddleware["wrapGenerate"]>
type GenerateResult = Awaited<ReturnType<WrapGenerate>>
type CallOptions = Parameters<WrapGenerate>[0]["params"]

/**
 * Where model answers are recorded and replayed from. `record` calls the model
 * and writes each answer to `directory`; `replay` serves answers from there and
 * never calls the model.
 *
 * @experimental
 */
export interface Recordings {
  mode: "record" | "replay"
  directory: string
}

export class MissingRecordingError extends Error {
  constructor(key: string) {
    super(`No recorded answer for this ask (${key})`)
    this.name = "MissingRecordingError"
  }
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

function fromRecording(text: string): GenerateResult {
  const { key, source, standIn, result } = recordingSchema.parse(
    JSON.parse(text)
  )
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

/**
 * Records model answers to JSON files keyed by `recordingKey`, or replays them,
 * following the AI SDK's caching middleware pattern.
 */
export function recordingMiddleware({
  mode,
  directory,
}: Recordings): LanguageModelMiddleware {
  return {
    specificationVersion: "v4",
    wrapGenerate: async ({ doGenerate, params, model }) => {
      const key = recordingKey(model, params)
      const file = join(directory, `${key}.json`)
      if (mode === "replay") {
        let text: string
        try {
          text = await readFile(file, "utf8")
        } catch (error) {
          throw isMissing(error) ? new MissingRecordingError(key) : error
        }
        return fromRecording(text)
      }
      const result = await doGenerate()
      await mkdir(directory, { recursive: true })
      await writeFile(
        file,
        `${JSON.stringify(toRecording(key, model, result, new Date()), null, 2)}\n`
      )
      return result
    },
  }
}
