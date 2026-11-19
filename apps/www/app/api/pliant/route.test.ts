import { afterEach, describe, expect, it, vi } from "vitest"

import { askTargets } from "@/app/(examples)/examples/orders/ask-targets"

import { POST } from "./route"

function ask(prompt = "put the overdue card first") {
  return new Request("http://localhost/api/pliant", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      surface: "/examples/orders",
      target: "key-metrics",
      prompt,
      context: askTargets[0]?.context,
    }),
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("POST /api/pliant", () => {
  it("is turned off unless PLIANT_ASK_ENABLED is 1", async () => {
    vi.stubEnv("PLIANT_ASK_ENABLED", "")

    const response = await POST(ask())

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      status: "error",
      message: "Asking is turned off on this site.",
    })
  })

  it("answers from the committed recordings when turned on", async () => {
    vi.stubEnv("PLIANT_ASK_ENABLED", "1")
    vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const response = await POST(ask())

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: "ok",
      overlay: {
        surface: "/examples/orders",
        layer: "session",
        ops: [
          { op: "move", target: "key-metrics/slots/overdue", to: { index: 0 } },
        ],
      },
      explain: ["Moved the Overdue card to the first position."],
    })
  })

  it("lists the recorded asks for an ask it has no answer to", async () => {
    vi.stubEnv("PLIANT_ASK_ENABLED", "1")

    const response = await POST(ask("Put the overdue card first"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: "unavailable",
      reason:
        "This demo only answers its recorded asks. Try one of the suggestions.",
    })
  })
})
