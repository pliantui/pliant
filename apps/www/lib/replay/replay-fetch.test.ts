import { describe, expect, it } from "vitest"

import { opSchema, overlaySchema } from "@pliantui/contract"

import { recordedAnswers } from "./recorded-answers.generated"
import { isScriptedAsk, replayAnswer, replayFetch } from "./replay-fetch"
import { scriptedAnswers, scriptedDeclines } from "./scripted-answers"

async function ask(body: unknown) {
  const response = await replayFetch("/replay", {
    method: "POST",
    body: JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json()) as unknown }
}

describe("replay data", () => {
  it("never has an ask that is both recorded and scripted", () => {
    const key = (ask: { target: string; prompt: string }) =>
      `${ask.target}\u0000${ask.prompt.toLowerCase()}`
    const recorded = new Set(recordedAnswers.map(key))

    expect(
      [...scriptedAnswers, ...scriptedDeclines].filter((ask) =>
        recorded.has(key(ask))
      )
    ).toEqual([])
  })
})

describe("replayFetch", () => {
  it("answers a recorded ask with its recording, on the asking surface", async () => {
    const { body } = await ask({
      surface: "/",
      target: "orders-table",
      prompt: "hide the notes column",
    })

    expect(body).toMatchObject({
      status: "ok",
      explain: ["Hid the Notes column from the orders table."],
      overlay: {
        surface: "/",
        layer: "session",
        ops: [{ op: "hide", target: "orders-table/columns/notes" }],
      },
    })
    expect(
      overlaySchema.safeParse((body as { overlay: unknown }).overlay).success
    ).toBe(true)
  })

  it("answers only the exact ask that was recorded", async () => {
    const answer = (prompt: string) =>
      ask({ surface: "/", target: "key-metrics", prompt })

    expect((await answer(" put the overdue card first ")).body).toMatchObject({
      status: "ok",
    })
    expect((await answer("Put the overdue card first")).body).toMatchObject({
      status: "unavailable",
    })
  })

  it("gives each answer its own overlay id", async () => {
    const request = {
      surface: "/",
      target: "key-metrics",
      prompt: "put the overdue card first",
    }
    const first = (await ask(request)).body as { overlay: { id: string } }
    const second = (await ask(request)).body as { overlay: { id: string } }

    expect(first.overlay.id).not.toBe(second.overlay.id)
  })

  it("says an ask that matches no suggestion isn't answered", async () => {
    const { body } = await ask({
      surface: "/",
      target: "orders-table",
      prompt: "make every row green",
    })

    expect(body).toEqual({
      status: "unavailable",
      reason: "This demo answers only its suggested asks.",
    })
  })

  it("answers a scripted ask with its scripted answer", async () => {
    const [scripted] = scriptedAnswers

    expect(
      (
        await ask({
          surface: "/",
          target: scripted?.target,
          prompt: scripted?.prompt,
        })
      ).body
    ).toMatchObject({ status: "ok", explain: scripted?.explain })
  })

  it("rejects a request it can't read", async () => {
    expect((await ask({ prompt: 1 })).status).toBe(400)
    const response = await replayFetch("/replay", {
      method: "POST",
      body: "not json",
    })
    expect(response.status).toBe(400)
  })
})

describe("scripted answers", () => {
  it("answer only when asked for, for a caller that labels them", () => {
    for (const { target, prompt, explain } of scriptedAnswers) {
      expect(isScriptedAsk(target, prompt)).toBe(true)
      const answer = replayAnswer({ surface: "/", target, prompt })
      // Marked as a suggestion chip's change, never as an AI answer.
      expect(answer).toMatchObject({
        status: "ok",
        explain,
        overlay: { source: "chip" },
      })
      expect(
        answer.status === "ok" &&
          overlaySchema.safeParse(answer.overlay).success
      ).toBe(true)
    }
  })

  it("are valid operations on the node they're asked about", () => {
    for (const { target, ops } of scriptedAnswers) {
      for (const op of ops) {
        expect(opSchema.safeParse(op).success).toBe(true)
        expect(op.target.startsWith(target)).toBe(true)
      }
    }
  })

  it("decline an ask the data can't answer, changing nothing", () => {
    for (const { target, prompt, reason } of scriptedDeclines) {
      expect(isScriptedAsk(target, prompt)).toBe(true)
      expect(replayAnswer({ surface: "/", target, prompt })).toEqual({
        status: "unavailable",
        reason,
      })
    }
  })

  it("never stand in for a recorded ask", () => {
    for (const { target, prompt } of recordedAnswers) {
      expect(isScriptedAsk(target, prompt)).toBe(false)
    }
  })
})
