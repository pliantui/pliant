import { beforeEach, describe, expect, it } from "vitest"

import { readSession, writeSession } from "./session-mirror"

const key = "pliant:session:/orders"
const overlays = [{ id: "01KAB0000000000000000000S1" }]

beforeEach(() => {
  sessionStorage.clear()
})

describe("readSession", () => {
  it("reads back what was written", () => {
    writeSession("/orders", { overlays, preview: { id: "p" } })

    expect(readSession("/orders")).toEqual({ overlays, preview: { id: "p" } })
    expect(readSession("/invoices")).toEqual({ overlays: [], preview: null })
  })

  it.each([
    ["JSON that doesn't parse", "{"],
    ["another version", JSON.stringify({ v: 2, overlays, preview: null })],
    ["overlays that aren't a list", JSON.stringify({ v: 1, overlays: {} })],
  ])("reads %s as an empty session", (_name, value) => {
    sessionStorage.setItem(key, value)

    expect(readSession("/orders")).toEqual({ overlays: [], preview: null })
  })
})
