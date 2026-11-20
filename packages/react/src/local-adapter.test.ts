import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { storedOverlaySchema, type Overlay } from "@pliantui/contract"

import { localAdapter } from "./local-adapter"
import { StorageConflictError } from "./storage-conflict-error"

const key = "pliant:/orders"

function overlay(id: string, width: number): Overlay {
  return {
    v: 1,
    id,
    surface: "/orders",
    layer: "personal",
    ops: [
      { op: "setColumnWidth", target: "orders-table/columns/total", width },
    ],
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "manual",
    createdBy: "local",
    createdAt: "2026-11-19T00:00:00.000Z",
  }
}

const p1 = "01KAB0000000000000000000P1"
const p2 = "01KAB0000000000000000000P2"

function sync<T>(value: T | Promise<T>): T {
  if (value instanceof Promise) {
    throw new TypeError("Expected localAdapter to answer synchronously")
  }
  return value
}

/** `localAdapter`, typed as the synchronous adapter it is. */
function local() {
  const adapter = localAdapter()
  return {
    ...adapter,
    load: (surface: string) => sync(adapter.load(surface)),
    save: (...args: Parameters<typeof adapter.save>) =>
      sync(adapter.save(...args)),
    remove: (...args: Parameters<typeof adapter.remove>) => {
      sync(adapter.remove(...args))
    },
  }
}

function conflictOf(write: () => unknown) {
  try {
    write()
  } catch (error) {
    if (error instanceof StorageConflictError) {
      return error
    }
    throw error
  }
  throw new Error("Expected a conflict")
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("localAdapter", () => {
  it("saves overlays per surface and loads them back as records", () => {
    const adapter = local()
    const first = adapter.save("/orders", overlay(p1, 200), { ifMatch: null })
    adapter.save("/orders", overlay(p2, 220), { ifMatch: null })
    adapter.save("/orders", overlay(p1, 240), { ifMatch: first.etag })

    const { personal = [] } = adapter.load("/orders")
    expect(personal.map((record) => record.overlay)).toEqual([
      overlay(p2, 220),
      overlay(p1, 240),
    ])
    expect(personal).toMatchObject([{ version: 1 }, { version: 2 }])
    expect(adapter.load("/invoices")).toEqual({ personal: [] })
  })

  it("returns the stored record, with a new etag on every save", () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 20) })
    const adapter = local()
    const first = adapter.save("/orders", overlay(p1, 200), { ifMatch: null })
    const second = adapter.save("/orders", overlay(p1, 200), {
      ifMatch: first.etag,
    })
    vi.useRealTimers()

    expect(storedOverlaySchema.parse(first)).toEqual(first)
    expect(first).toMatchObject({
      overlay: overlay(p1, 200),
      version: 1,
      updatedAt: "2026-11-20T00:00:00.000Z",
    })
    expect(second.version).toBe(2)
    expect(second.etag).not.toBe(first.etag)
  })

  it("rejects a save with a stale etag and keeps the stored record", () => {
    const tab = local()
    const other = local()
    const first = tab.save("/orders", overlay(p1, 200), { ifMatch: null })
    const second = other.save("/orders", overlay(p1, 220), {
      ifMatch: first.etag,
    })

    const conflict = conflictOf(() =>
      tab.save("/orders", overlay(p1, 260), { ifMatch: first.etag })
    )
    expect(conflict.current).toEqual(second)
    expect(tab.load("/orders")).toEqual({ personal: [second] })
  })

  it("rejects a stale etag after the overlay changed and changed back", () => {
    const adapter = local()
    const a = adapter.save("/orders", overlay(p1, 200), { ifMatch: null })
    const b = adapter.save("/orders", overlay(p1, 220), { ifMatch: a.etag })
    const again = adapter.save("/orders", overlay(p1, 200), { ifMatch: b.etag })

    expect(
      conflictOf(() =>
        adapter.save("/orders", overlay(p1, 260), { ifMatch: a.etag })
      ).current
    ).toEqual(again)
  })

  it("rejects a stale etag after the overlay was removed and saved again", () => {
    const adapter = local()
    const first = adapter.save("/orders", overlay(p1, 200), { ifMatch: null })
    adapter.remove("/orders", p1, { ifMatch: first.etag })
    const again = adapter.save("/orders", overlay(p1, 200), { ifMatch: null })

    expect(again.etag).not.toBe(first.etag)
    expect(
      conflictOf(() =>
        adapter.save("/orders", overlay(p1, 260), { ifMatch: first.etag })
      ).current
    ).toEqual(again)
  })

  it("stores a new overlay only when none has its id", () => {
    const adapter = local()
    const first = adapter.save("/orders", overlay(p1, 200), { ifMatch: null })

    expect(
      conflictOf(() =>
        adapter.save("/orders", overlay(p1, 220), { ifMatch: null })
      ).current
    ).toEqual(first)
    expect(
      conflictOf(() =>
        adapter.save("/orders", overlay(p2, 220), { ifMatch: first.etag })
      ).current
    ).toBeUndefined()
  })

  it("removes an overlay only with its current etag", () => {
    const adapter = local()
    const first = adapter.save("/orders", overlay(p1, 200), { ifMatch: null })
    const second = adapter.save("/orders", overlay(p1, 220), {
      ifMatch: first.etag,
    })
    const kept = adapter.save("/orders", overlay(p2, 220), { ifMatch: null })

    expect(
      conflictOf(() => {
        adapter.remove("/orders", p1, { ifMatch: first.etag })
      }).current
    ).toEqual(second)
    adapter.remove("/orders", p1, { ifMatch: second.etag })
    expect(adapter.load("/orders")).toEqual({ personal: [kept] })
    adapter.remove("/orders", p1, { ifMatch: second.etag })
    expect(adapter.load("/orders")).toEqual({ personal: [kept] })
  })

  it("lists the personal records of every surface", () => {
    const adapter = local()
    const orders = adapter.save("/orders", overlay(p1, 200), { ifMatch: null })
    const invoices = adapter.save(
      "/invoices",
      { ...overlay(p2, 220), surface: "/invoices" },
      { ifMatch: null }
    )
    localStorage.setItem("unrelated", "{}")

    expect(adapter.list?.("personal")).toEqual(
      expect.arrayContaining([orders, invoices])
    )
    expect(adapter.list?.("personal")).toHaveLength(2)
    expect(adapter.list?.("team")).toEqual([])
  })

  it("stores personal overlays only", () => {
    expect(() =>
      local().save(
        "/orders",
        { ...overlay(p1, 200), layer: "team", scope: { team: "ops" } },
        { ifMatch: null }
      )
    ).toThrow("localAdapter stores personal overlays only")
    expect(localStorage.getItem(key)).toBeNull()
  })

  it("tells other tabs when a surface's overlays change", () => {
    const onChange = vi.fn()
    const unsubscribe = local().subscribe?.("/orders", onChange)
    const otherTab = (eventKey: string | null, storageArea = localStorage) => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: eventKey, storageArea })
      )
    }

    otherTab("pliant:/invoices")
    otherTab(key, sessionStorage)
    expect(onChange).not.toHaveBeenCalled()
    otherTab(key)
    otherTab(null)
    expect(onChange).toHaveBeenCalledTimes(2)

    unsubscribe?.()
    otherTab(key)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it("keeps saved entries it doesn't understand", () => {
    const newer = {
      overlay: overlay(p1, 200),
      etag: "1",
      version: 1,
      updatedAt: "2026-11-19T00:00:00.000Z",
      extra: 1,
    }
    const broken = { overlay: overlay(p2, 200), etag: "2", version: "3" }
    localStorage.setItem(
      key,
      JSON.stringify({ v: 1, personal: [7, broken, newer] })
    )
    const adapter = local()
    const saved = adapter.save("/orders", overlay(p2, 220), { ifMatch: null })

    expect(storedOverlaySchema.parse(saved)).toEqual(saved)
    expect(saved.version).toBe(1)
    expect(adapter.load("/orders")).toEqual({ personal: [newer, saved] })
    expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual({
      v: 1,
      personal: [7, broken, newer, saved],
    })
  })

  it.each([
    ["JSON that doesn't parse", "{"],
    ["a value that isn't an object", "42"],
    ["a document without a version", JSON.stringify({ personal: [] })],
    [
      "personal overlays that aren't a list",
      JSON.stringify({ v: 1, personal: {} }),
    ],
  ])("loads %s as no overlays", (_name, value) => {
    localStorage.setItem(key, value)

    expect(local().load("/orders")).toEqual({ personal: [] })
  })

  it("never overwrites data written by a newer version", () => {
    const newer = JSON.stringify({ v: 2, layers: [] })
    localStorage.setItem(key, newer)
    const adapter = local()

    expect(() =>
      adapter.save("/orders", overlay(p1, 200), { ifMatch: null })
    ).toThrow("written by a newer version of Pliant")
    expect(adapter.load("/orders")).toEqual({ personal: [] })
    expect(localStorage.getItem(key)).toBe(newer)
  })

  it("throws when storage is full", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is full", "QuotaExceededError")
    })

    expect(() =>
      local().save("/orders", overlay(p1, 200), { ifMatch: null })
    ).toThrow("Storage is full")
  })
})
