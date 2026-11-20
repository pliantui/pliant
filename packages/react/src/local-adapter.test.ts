import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  storedOverlaySchema,
  type Overlay,
  type StoredOverlay,
} from "@pliantui/contract"

import { localAdapter } from "./local-adapter"
import type { StorageAdapter } from "./storage-adapter"
import { StorageConflictError } from "./storage-conflict-error"

const p1 = "01KAB0000000000000000000P1"
const p2 = "01KAB0000000000000000000P2"
const p3 = "01KAB0000000000000000000P3"
const keyOf = (id: string, surface = "/orders") => `pliant:${surface}:${id}`

function overlay(id: string, width: number, surface = "/orders"): Overlay {
  return {
    v: 1,
    id,
    surface,
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
    load: (surface: string) => sync(adapter.load(surface)).personal ?? [],
    save: (...args: Parameters<StorageAdapter["save"]>) =>
      sync(adapter.save(...args)),
    history: (surface: string, id?: string) => {
      if (!adapter.history) {
        throw new TypeError("Expected localAdapter to keep history")
      }
      return sync(adapter.history(surface, id))
    },
    remove: (...args: Parameters<NonNullable<StorageAdapter["remove"]>>) => {
      if (!adapter.remove) {
        throw new TypeError("Expected localAdapter to remove")
      }
      sync(adapter.remove(...args))
    },
    subscribe: (
      ...args: Parameters<NonNullable<StorageAdapter["subscribe"]>>
    ) => {
      if (!adapter.subscribe) {
        throw new TypeError("Expected localAdapter to subscribe")
      }
      return adapter.subscribe(...args)
    },
  }
}

function byId(records: readonly StoredOverlay[]) {
  return records.toSorted((a, b) => (a.overlay.id < b.overlay.id ? -1 : 1))
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
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("localAdapter", () => {
  it("saves overlays per surface and loads them back as records", () => {
    const adapter = local()
    const first = adapter.save("/orders", overlay(p1, 200), { ifMatch: null })
    const other = adapter.save("/orders", overlay(p2, 220), { ifMatch: null })
    const updated = adapter.save("/orders", overlay(p1, 240), {
      ifMatch: first.etag,
    })
    const invoices = adapter.save("/invoices", overlay(p1, 260, "/invoices"), {
      ifMatch: null,
    })

    expect(byId(adapter.load("/orders"))).toEqual([updated, other])
    expect(adapter.load("/invoices")).toEqual([invoices])
    expect(adapter.load("/orders/[id]")).toEqual([])
    expect(updated.version).toBe(2)
  })

  it("stores each overlay under its own key", () => {
    const record = local().save("/orders", overlay(p1, 200), { ifMatch: null })

    expect(JSON.parse(localStorage.getItem(keyOf(p1)) ?? "null")).toEqual(
      record
    )
  })

  it("returns the stored record, with a new etag on every save", () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 20) })
    const adapter = local()
    const first = adapter.save("/orders", overlay(p1, 200), { ifMatch: null })
    const second = adapter.save("/orders", overlay(p1, 200), {
      ifMatch: first.etag,
    })

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

    expect(
      conflictOf(() =>
        tab.save("/orders", overlay(p1, 260), { ifMatch: first.etag })
      ).current
    ).toEqual(second)
    expect(tab.load("/orders")).toEqual([second])
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

  it("leaves a tombstone in place of a removed overlay", () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 20) })
    const adapter = local()
    const first = adapter.save("/orders", overlay(p1, 200), { ifMatch: null })
    vi.setSystemTime(Date.UTC(2026, 10, 21))
    adapter.remove("/orders", p1, { ifMatch: first.etag })
    const [tombstone] = adapter.history("/orders", p1)

    expect(adapter.load("/orders")).toEqual([])
    expect(tombstone?.etag).not.toBe(first.etag)
    expect(tombstone).toMatchObject({
      overlay: overlay(p1, 200),
      version: 2,
      updatedAt: "2026-11-21T00:00:00.000Z",
      deletedAt: "2026-11-21T00:00:00.000Z",
    })
    expect(storedOverlaySchema.parse(tombstone)).toEqual(tombstone)
  })

  it("never stores an overlay again under a removed id", () => {
    const adapter = local()
    const first = adapter.save("/orders", overlay(p1, 200), { ifMatch: null })
    adapter.remove("/orders", p1, { ifMatch: first.etag })
    const [tombstone] = adapter.history("/orders", p1)

    expect(
      conflictOf(() =>
        adapter.save("/orders", overlay(p1, 200), { ifMatch: null })
      ).current
    ).toEqual(tombstone)
    expect(
      conflictOf(() =>
        adapter.save("/orders", overlay(p1, 220), {
          ifMatch: tombstone?.etag ?? null,
        })
      ).current
    ).toEqual(tombstone)
    adapter.remove("/orders", p1, { ifMatch: tombstone?.etag ?? "" })
    expect(adapter.history("/orders", p1)).toEqual([tombstone])
  })

  it("returns a surface's records, tombstones included, oldest first", () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 20) })
    const adapter = local()
    const first = adapter.save("/orders", overlay(p1, 200), { ifMatch: null })
    vi.setSystemTime(Date.UTC(2026, 10, 21))
    const second = adapter.save("/orders", overlay(p2, 220), { ifMatch: null })
    vi.setSystemTime(Date.UTC(2026, 10, 22))
    adapter.remove("/orders", p1, { ifMatch: first.etag })
    adapter.save("/invoices", overlay(p1, 260, "/invoices"), { ifMatch: null })
    const [, tombstone] = adapter.history("/orders")

    expect(adapter.history("/orders")).toEqual([second, tombstone])
    expect(tombstone?.deletedAt).toBe("2026-11-22T00:00:00.000Z")
    expect(adapter.history("/orders", p2)).toEqual([second])
    expect(adapter.history("/orders/[id]")).toEqual([])
  })

  it("orders records saved in the same millisecond by version, then id", () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 20) })
    const adapter = local()
    const second = adapter.save("/orders", overlay(p2, 200), { ifMatch: null })
    const edited = adapter.save("/orders", overlay(p2, 210), {
      ifMatch: second.etag,
    })
    const third = adapter.save("/orders", overlay(p3, 230), { ifMatch: null })
    const first = adapter.save("/orders", overlay(p1, 220), { ifMatch: null })

    expect(adapter.history("/orders")).toEqual([first, third, edited])
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
    expect(adapter.load("/orders")).toEqual([kept])
    adapter.remove("/orders", p1, { ifMatch: second.etag })
    expect(adapter.load("/orders")).toEqual([kept])
  })

  it("stores personal overlays only", () => {
    expect(() =>
      local().save(
        "/orders",
        { ...overlay(p1, 200), layer: "team", scope: { team: "ops" } },
        { ifMatch: null }
      )
    ).toThrow("localAdapter stores personal overlays only")
    expect(localStorage.length).toBe(0)
  })

  it("loads the @app overlays with the overlays of every surface", () => {
    const adapter = local()
    adapter.save("@app", overlay(p3, 120, "@app"), { ifMatch: null })
    adapter.save("/orders", overlay(p1, 100), { ifMatch: null })

    expect(adapter.load("/orders").map(({ overlay }) => overlay.id)).toEqual(
      expect.arrayContaining([p1, p3])
    )
    expect(adapter.load("/invoices").map(({ overlay }) => overlay.id)).toEqual([
      p3,
    ])
  })

  it("leaves removed @app overlays out of a surface's load", () => {
    const adapter = local()
    const saved = adapter.save("@app", overlay(p3, 120, "@app"), {
      ifMatch: null,
    })
    adapter.save("/orders", overlay(p1, 100), { ifMatch: null })
    adapter.remove("@app", p3, { ifMatch: saved.etag })

    expect(adapter.load("/orders").map(({ overlay }) => overlay.id)).toEqual([
      p1,
    ])
    expect(adapter.load("@app")).toEqual([])
  })

  it("loads each @app overlay once when the surface is @app", () => {
    const adapter = local()
    adapter.save("@app", overlay(p3, 120, "@app"), { ifMatch: null })

    expect(adapter.load("@app").map(({ overlay }) => overlay.id)).toEqual([p3])
  })

  it("skips @app entries that aren't valid records", () => {
    localStorage.setItem(keyOf(p3, "@app"), "{}")

    expect(local().load("/orders")).toEqual([])
  })

  it("tells other tabs when the @app overlays change", () => {
    const onChange = vi.fn()
    const unsubscribe = local().subscribe("/orders", onChange)
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: keyOf(p3, "@app"),
        storageArea: localStorage,
      })
    )
    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it("tells other tabs when a surface's overlays change", () => {
    const onChange = vi.fn()
    const unsubscribe = local().subscribe("/orders", onChange)
    const otherTab = (key: string | null, storageArea = localStorage) => {
      window.dispatchEvent(new StorageEvent("storage", { key, storageArea }))
    }

    otherTab(keyOf(p1, "/invoices"))
    otherTab(keyOf(p1, "/orders/[id]"))
    otherTab(keyOf(p1), sessionStorage)
    expect(onChange).not.toHaveBeenCalled()
    otherTab(keyOf(p1))
    otherTab(null)
    expect(onChange).toHaveBeenCalledTimes(2)

    unsubscribe()
    otherTab(keyOf(p1))
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it("tells other adapters in this tab when a surface's overlays change", async () => {
    const onChange = vi.fn()
    const onOtherSurface = vi.fn()
    const unsubscribe = local().subscribe("/orders", onChange)
    local().subscribe("/invoices", onOtherSurface)
    const writer = local()

    const record = writer.save("/orders", overlay(p1, 200), { ifMatch: null })
    await Promise.resolve()
    expect(onChange).toHaveBeenCalledTimes(1)
    writer.remove("/orders", p1, { ifMatch: record.etag })
    await Promise.resolve()
    expect(onChange).toHaveBeenCalledTimes(2)

    unsubscribe()
    writer.save("/orders", overlay(p2, 200), { ifMatch: null })
    await Promise.resolve()
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onOtherSurface).not.toHaveBeenCalled()
  })

  it.each([
    ["JSON that doesn't parse", "{"],
    ["a value that isn't an object", "42"],
    ["a record from a newer version", JSON.stringify({ v: 2, layers: [] })],
    [
      "a record without a valid version",
      JSON.stringify({
        overlay: overlay(p1, 200),
        etag: "1",
        version: 0,
        updatedAt: "2026-11-19T00:00:00.000Z",
      }),
    ],
    [
      "a record with an invalid date",
      JSON.stringify({
        overlay: overlay(p1, 200),
        etag: "1",
        version: 1,
        updatedAt: "yesterday",
      }),
    ],
  ])("doesn't load or overwrite %s", (_name, value) => {
    localStorage.setItem(keyOf(p1), value)
    const adapter = local()

    expect(adapter.load("/orders")).toEqual([])
    expect(
      conflictOf(() =>
        adapter.save("/orders", overlay(p1, 220), { ifMatch: null })
      ).current
    ).toBeUndefined()
    expect(localStorage.getItem(keyOf(p1))).toBe(value)
  })

  it("ignores the surface document of earlier versions", () => {
    localStorage.setItem(
      "pliant:/orders",
      JSON.stringify({ v: 1, personal: [overlay(p2, 300)] })
    )
    const adapter = local()
    const record = adapter.save("/orders", overlay(p1, 200), { ifMatch: null })

    expect(adapter.load("/orders")).toEqual([record])
  })

  it("keeps fields it doesn't know in a record", () => {
    const record = {
      overlay: { ...overlay(p1, 200), future: true },
      etag: "1",
      version: 3,
      updatedAt: "2026-11-19T00:00:00.000Z",
      future: { kept: true },
    }
    localStorage.setItem(keyOf(p1), JSON.stringify(record))

    expect(local().load("/orders")).toEqual([record])
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
