import { describe, expect, it, vi } from "vitest"

import { recordedAnswers } from "@/lib/replay/recorded-answers.generated"

import { replayDemoAsks } from "./build-replays"

describe("recorded answers", () => {
  it("match what the committed recordings replay", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    expect(await replayDemoAsks()).toEqual(recordedAnswers)
  })
})
