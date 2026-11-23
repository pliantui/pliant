import { recordedAnswers as recorded } from "./recorded-answers.generated"
import { scriptedAnswers, scriptedDeclines } from "./scripted-answers"

// Answers asks in the browser from the answers recorded for the demo, so
// asking needs no server and calls no model. Pass `replayFetch` to
// `PliantAskPanel` as `fetch`; it answers only from recordings.

export const replayNote =
  "This demo replays recorded answers; no AI model is called."

export const replayNoteWithScripted =
  "This demo replays recorded answers, and hand-written answers for the asks marked scripted; no AI model is called."

const unrecordedReason =
  "This demo only answers its recorded asks. Try one of the suggestions."

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

function ulid(time: number) {
  let timePart = ""
  let rest = time
  for (let index = 0; index < 10; index++) {
    timePart = alphabet.charAt(rest % 32) + timePart
    rest = Math.floor(rest / 32)
  }
  const random = Array.from(
    crypto.getRandomValues(new Uint8Array(16)),
    (byte) => alphabet.charAt(byte % 32)
  ).join("")
  return timePart + random
}

// A recording answers only the exact ask it was made for.
function same(a: string, b: string) {
  return a.trim() === b.trim()
}

interface Ask {
  surface: string
  target: string
  prompt: string
}

function isAsk(value: unknown): value is Ask {
  return (
    typeof value === "object" &&
    value !== null &&
    "surface" in value &&
    typeof value.surface === "string" &&
    "target" in value &&
    typeof value.target === "string" &&
    "prompt" in value &&
    typeof value.prompt === "string"
  )
}

export function isScriptedAsk(target: string, prompt: string) {
  return [...scriptedAnswers, ...scriptedDeclines].some(
    (answer) => answer.target === target && same(answer.prompt, prompt)
  )
}

type ReplayedAnswer =
  | {
      status: "ok"
      overlay: { id: string } & Record<string, unknown>
      explain: string[]
    }
  | { status: "clarify"; question: string }
  | { status: "unavailable"; reason: string }

// The answer to an ask, in the shape `createPliantHandler` sends. Scripted
// answers come back only with `scripted`, for callers that label them.
export function replayAnswer(
  { surface, target, prompt }: Ask,
  { scripted = false }: { scripted?: boolean } = {}
): ReplayedAnswer {
  // Scripted answers are marked as coming from a suggestion chip, never as
  // an AI's answer.
  const overlay = (
    ops: unknown[],
    basis: unknown,
    explain: string[],
    source: "ai" | "chip" = "ai"
  ): ReplayedAnswer => {
    const now = Date.now()
    return {
      status: "ok" as const,
      overlay: {
        v: 1,
        id: ulid(now),
        surface,
        ops,
        basis,
        source,
        explain,
        createdBy: "anonymous",
        createdAt: new Date(now).toISOString(),
        layer: "session",
      },
      explain,
    }
  }

  const match = recorded.find(
    (entry) => entry.target === target && same(entry.prompt, prompt)
  )
  if (match) {
    const { answer } = match
    return answer.status === "ok"
      ? overlay(answer.ops, answer.basis, answer.explain)
      : answer
  }
  const script = scripted
    ? scriptedAnswers.find(
        (entry) => entry.target === target && same(entry.prompt, prompt)
      )
    : undefined
  const decline = scripted
    ? scriptedDeclines.find(
        (entry) => entry.target === target && same(entry.prompt, prompt)
      )
    : undefined
  if (decline) return { status: "unavailable", reason: decline.reason }
  if (script) {
    return overlay(
      script.ops,
      { contract: 1, core: "0.0.0", manifests: { [script.kind]: 1 } },
      script.explain,
      "chip"
    )
  }
  return { status: "unavailable", reason: unrecordedReason }
}

export function replayFetch(
  _input: Parameters<typeof fetch>[0],
  init?: RequestInit
): Promise<Response> {
  let body: unknown
  try {
    body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined
  } catch {
    body = undefined
  }
  if (!isAsk(body)) {
    return Promise.resolve(
      Response.json(
        { status: "error", message: "The ask couldn't be read." },
        { status: 400 }
      )
    )
  }
  return Promise.resolve(Response.json(replayAnswer(body)))
}
