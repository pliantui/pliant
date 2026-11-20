import { describe, expect, it } from "vitest"

import { mergeById } from "./overlay-list"

describe("mergeById", () => {
  it("drops saved overlays that current ones replace", () => {
    expect(
      mergeById(
        [
          { id: "a", width: 1 },
          { id: "b", width: 1 },
        ],
        [{ id: "a", width: 2 }]
      )
    ).toEqual([
      { id: "b", width: 1 },
      { id: "a", width: 2 },
    ])
  })

  it("keeps saved entries without an id", () => {
    expect(mergeById([7, { id: "a" }], [8])).toEqual([7, { id: "a" }, 8])
  })
})
