import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { validateOverlay, type ValidatedOverlay } from "@pliantui/core"

import { createSaveQueue } from "./save-queue"

function version(id: string): ValidatedOverlay {
  const result = validateOverlay(
    {
      v: 1,
      id,
      surface: "/orders",
      layer: "personal",
      ops: [
        {
          op: "setColumnWidth",
          target: "orders-table/columns/total",
          width: 240,
        },
      ],
      basis: { contract: 1, core: "0.0.0", manifests: {} },
      source: "manual",
      createdBy: "local",
      createdAt: "2026-11-19T00:00:00.000Z",
    },
    {
      layers: {
        overlays: [],
        surface: "/orders",
        baseIds: { ids: ["orders-table"], source: "mounted" },
        teamOrder: [],
      },
    }
  )
  if (!result.success) {
    throw result.error
  }
  return result.data
}

const first = version("01KAB0000000000000000000P1")
const second = version("01KAB0000000000000000000P2")

function setup(write: (overlay: ValidatedOverlay) => void | Promise<void>) {
  const written: string[] = []
  const report = vi.fn()
  const queue = createSaveQueue({
    write: (overlay) => {
      written.push(overlay.id)
      return write(overlay)
    },
    report,
    now: Date.now,
  })
  return { queue, written, report }
}

beforeEach(() => {
  vi.useFakeTimers({ now: Date.UTC(2026, 10, 19) })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createSaveQueue", () => {
  it("saves a version at once", () => {
    const { queue, written } = setup(() => undefined)

    queue.save(first)

    expect(written).toEqual([first.id])
  })

  it("saves a deferred version after a second, or on flush", () => {
    const { queue, written } = setup(() => undefined)

    queue.defer(first, "width")
    expect(written).toEqual([])
    vi.advanceTimersByTime(1000)
    expect(written).toEqual([first.id])

    queue.defer(second, "width")
    queue.flush()
    expect(written).toEqual([first.id, second.id])
    vi.advanceTimersByTime(1000)
    expect(written).toEqual([first.id, second.id])
  })

  it("finds the deferred version a change with the same key replaces", () => {
    const { queue } = setup(() => undefined)

    queue.defer(first, "width")

    expect(queue.pendingId("width")).toBe(first.id)
    expect(queue.pendingId("sort")).toBeUndefined()
    vi.advanceTimersByTime(999)
    expect(queue.pendingId("width")).toBe(first.id)
  })

  it("replaces nothing once the window has passed", () => {
    const { queue } = setup(() => undefined)

    queue.defer(first, "width")
    vi.setSystemTime(Date.now() + 1000)

    expect(queue.pendingId("width")).toBeUndefined()
  })

  it("retries a failed save on every flush and reports each failure once", () => {
    let error: Error | undefined = new Error("quota")
    const { queue, written, report } = setup(() => {
      if (error) {
        throw error
      }
    })

    queue.save(first)
    queue.flush()
    expect(written).toEqual([first.id, first.id])
    expect(report).toHaveBeenCalledTimes(1)

    error = new Error("offline")
    queue.flush()
    expect(report).toHaveBeenCalledTimes(2)

    error = undefined
    queue.flush()
    queue.flush()
    expect(written).toEqual([first.id, first.id, first.id, first.id])

    error = new Error("offline")
    queue.save(first)
    expect(report).toHaveBeenCalledTimes(3)
  })

  it("retries a rejected save on the next flush", async () => {
    let fail = true
    const { queue, written, report } = setup(() =>
      fail ? Promise.reject(new Error("offline")) : Promise.resolve()
    )

    queue.save(first)
    await vi.waitFor(() => {
      expect(report).toHaveBeenCalledTimes(1)
    })
    fail = false
    queue.flush()
    queue.flush()

    expect(written).toEqual([first.id, first.id])
  })
})
