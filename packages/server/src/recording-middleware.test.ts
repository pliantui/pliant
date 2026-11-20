import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { generateText, wrapLanguageModel } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import {
  afterEach,
  assertType,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import {
  recordingMiddleware,
  type RecordingOptions,
} from "./recording-middleware"

type Generate = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>

const answer: Generate = {
  content: [{ type: "text", text: "Recorded" }],
  finishReason: { unified: "stop", raw: "end_turn" },
  usage: {
    inputTokens: {
      total: 3,
      noCache: 3,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: 1, text: 1, reasoning: undefined },
  },
  warnings: [],
  providerMetadata: {
    recording: { source: "a stand-in", standIn: true },
  },
}

let directory = ""

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "pliant-recordings-"))
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(directory, { recursive: true, force: true })
})

function run(
  mode: "record" | "replay",
  model: MockLanguageModelV4,
  prompt = "Hello"
) {
  return generateText({
    model: wrapLanguageModel({
      model,
      middleware: recordingMiddleware({ mode, directory }),
    }),
    instructions: "Be brief.",
    prompt,
  })
}

describe("recordingMiddleware", () => {
  it("writes the answer with its provenance at the top of the file", async () => {
    await run("record", new MockLanguageModelV4({ doGenerate: answer }))
    const [file = ""] = await readdir(directory)
    const recording: unknown = JSON.parse(
      await readFile(join(directory, file), "utf8")
    )

    expect(recording).toMatchObject({
      key: file.replace(/\.json$/, ""),
      provider: "mock-provider",
      modelId: "mock-model-id",
      recordedAt: expect.any(String) as string,
      source: "a stand-in",
      standIn: true,
      result: { content: [{ type: "text", text: "Recorded" }] },
    })
    expect(recording).not.toHaveProperty("result.providerMetadata")
  })

  it("replays by model and prompt, and warns once about stand-ins", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    await run("record", new MockLanguageModelV4({ doGenerate: answer }))
    const replayer = new MockLanguageModelV4({ doGenerate: [] })

    expect((await run("replay", replayer)).text).toBe("Recorded")
    expect((await run("replay", replayer)).text).toBe("Recorded")
    expect(replayer.doGenerateCalls).toHaveLength(0)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain("stand-in")

    await expect(run("replay", replayer, "Something else")).rejects.toThrow(
      "No recorded answer for this ask"
    )
    await expect(
      run(
        "replay",
        new MockLanguageModelV4({ modelId: "other-model", doGenerate: [] })
      )
    ).rejects.toThrow("No recorded answer for this ask")
  })

  describe("replaying from recordings in memory", () => {
    async function recorded() {
      await run("record", new MockLanguageModelV4({ doGenerate: answer }))
      const [file = ""] = await readdir(directory)
      const recording: unknown = JSON.parse(
        await readFile(join(directory, file), "utf8")
      )
      return recording
    }

    function replay(
      recordings: readonly unknown[],
      model: MockLanguageModelV4,
      prompt = "Hello"
    ) {
      return generateText({
        model: wrapLanguageModel({
          model,
          middleware: recordingMiddleware({ mode: "replay", recordings }),
        }),
        instructions: "Be brief.",
        prompt,
      })
    }

    it("replays the recording for the ask without calling the model", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined)
      const recording = await recorded()
      const replayer = new MockLanguageModelV4({ doGenerate: [] })

      const { text } = await replay([recording], replayer)

      expect(text).toBe("Recorded")
      expect(replayer.doGenerateCalls).toHaveLength(0)
    })

    it("throws MissingRecordingError for an ask with no recording", async () => {
      const recording = await recorded()

      await expect(
        replay(
          [recording],
          new MockLanguageModelV4({ doGenerate: [] }),
          "Something else"
        )
      ).rejects.toMatchObject({
        name: "MissingRecordingError",
        message: expect.stringContaining(
          "No recorded answer for this ask"
        ) as string,
      })
    })

    it("rejects a recording that doesn't match the recording format", () => {
      expect(() =>
        recordingMiddleware({
          mode: "replay",
          recordings: [{ key: "a-key", result: { content: "Recorded" } }],
        })
      ).toThrow("recordings[0] is not a valid recording")
    })

    it("rejects two recordings with the same key", async () => {
      const recording = await recorded()

      expect(() =>
        recordingMiddleware({
          mode: "replay",
          recordings: [recording, recording],
        })
      ).toThrow(/^Two recordings have the key [0-9a-f]{64}$/)
    })

    it.each([
      { mode: "record", recordings: [] },
      { mode: "replay", directory: "recordings", recordings: [] },
    ])(
      "rejects recordings outside replay or next to a directory: %o",
      (options) => {
        expect(() =>
          // A JavaScript caller, which the types don't stop.
          recordingMiddleware(options as unknown as RecordingOptions)
        ).toThrow(TypeError)
      }
    )

    it("takes a directory or recordings, not both", () => {
      // @ts-expect-error A replay source is a directory or recordings.
      assertType<RecordingOptions>({
        mode: "replay",
        directory,
        recordings: [],
      })
    })
  })
})
