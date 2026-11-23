import { describe, expect, it } from "vitest"

import { opCatalog } from "@pliantui/contract"

import { pliantAskChosenOps, pliantAskOpLabels } from "./pliant-ask-steps"

describe("pliantAskOpLabels", () => {
  it.each(Object.keys(opCatalog))("labels the %s op", (op) => {
    const label: unknown = Object.entries(pliantAskOpLabels).find(
      ([name]) => name === op
    )?.[1]

    expect(typeof label).toBe("string")
    expect(String(label).trim()).not.toBe("")
  })
})

describe("pliantAskChosenOps", () => {
  it("lists each op once, in order, and leaves out names that aren't ops", () => {
    expect(
      pliantAskChosenOps(["move", "hide", "move", "toString", "teleport"])
    ).toEqual(["move", "hide"])
  })
})
