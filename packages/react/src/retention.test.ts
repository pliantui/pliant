import { describe, expect, it, vi } from "vitest"

import { createRetention, type RetainScope } from "./retention"

function scope(parent: RetainScope | null = null): RetainScope {
  return { parent, held: 0 }
}

describe("createRetention", () => {
  it("releases at once outside any scope", () => {
    const release = vi.fn()
    createRetention().release(null, release)
    expect(release).toHaveBeenCalledOnce()
  })

  it("releases after the commit when no scope holds", async () => {
    const release = vi.fn()
    createRetention().release(scope(), release)

    expect(release).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(release).toHaveBeenCalledOnce()
  })

  it("keeps what a held scope, or a scope in it, releases until unheld", async () => {
    const retention = createRetention()
    const outer = scope()
    const inner = scope(outer)
    const release = vi.fn()

    retention.release(inner, release)
    const unhold = retention.hold(outer)
    await Promise.resolve()
    expect(release).not.toHaveBeenCalled()

    unhold()
    unhold()
    expect(outer.held).toBe(0)
    await Promise.resolve()
    expect(release).toHaveBeenCalledOnce()
  })
})
