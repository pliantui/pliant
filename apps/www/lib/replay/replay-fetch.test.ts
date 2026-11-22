import { describe, expect, it } from "vitest"

import { opSchema, overlaySchema } from "@pliantui/contract"

import { recordedAnswers } from "./recorded-answers.generated"
import { isScriptedAsk, replayAnswer, replayFetch } from "./replay-fetch"
import { scriptedAnswers } from "./scripted-answers"

async function ask(body: unknown) {
  const response = await replayFetch("/replay", {
    method: "POST",
    body: JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json()) as unknown }
}

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

  it("says an unrecorded ask isn't answered, and points at the suggestions", async () => {
    const { body } = await ask({
      surface: "/",
      target: "orders-table",
      prompt: "make every row green",
    })

    expect(body).toMatchObject({
      status: "unavailable",
      reason: expect.stringContaining("suggestions") as unknown,
    })
  })

  it("never answers with a scripted answer", async () => {
    const [scripted] = scriptedAnswers

    expect(
      (
        await ask({
          surface: "/",
          target: scripted?.target,
          prompt: scripted?.prompt,
        })
      ).body
    ).toMatchObject({ status: "unavailable" })
  })

  it("rejects a request it can't read", async () => {
    expect((await ask({ prompt: 1 })).status).toBe(400)
  })
})

describe("scripted answers", () => {
  it("answer only when asked for, for a caller that labels them", () => {
    for (const { target, prompt, explain } of scriptedAnswers) {
      expect(isScriptedAsk(target, prompt)).toBe(true)
      expect(
        replayAnswer({ surface: "/", target, prompt }, { scripted: true })
      ).toMatchObject({ status: "ok", explain })
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

  it("never stand in for a recorded ask", () => {
    for (const { target, prompt } of recordedAnswers) {
      expect(isScriptedAsk(target, prompt)).toBe(false)
    }
  })
})
