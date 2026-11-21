import { afterEach, describe, expect, it, vi } from "vitest"

import { formatStarCount, getStarCount } from "@/lib/github"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("getStarCount", () => {
  it("returns the star count GitHub reports", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ stargazers_count: 1234 })))
    )

    expect(await getStarCount()).toBe(1234)
  })

  it("returns null when GitHub answers with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json({ stargazers_count: 1234 }, { status: 403 })
        )
      )
    )

    expect(await getStarCount()).toBeNull()
  })

  it("returns null when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down")))
    )

    expect(await getStarCount()).toBeNull()
  })

  it("returns null when the answer has no star count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ stargazers_count: "many" })))
    )

    expect(await getStarCount()).toBeNull()
  })
})

describe("formatStarCount", () => {
  it("shortens large counts", () => {
    expect(formatStarCount(950)).toBe("950")
    expect(formatStarCount(1234)).toBe("1.2K")
    expect(formatStarCount(12_500)).toBe("12.5K")
  })
})
