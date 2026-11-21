import { describe, expect, it } from "vitest"

import type { StoredOverlay } from "@pliantui/contract"

import { memoryOverlayStore } from "./memory-overlay-store"
import type { OverlayKey } from "./overlay-store"

const by = { by: "ana" }

const key: OverlayKey = {
  surface: "/orders",
  layer: "team",
  scope: "ops",
  id: "01KAB0000000000000000000P1",
}

function record(etag: string, version: number): StoredOverlay {
  return {
    overlay: {
      v: 1,
      id: key.id,
      surface: key.surface,
      layer: "team",
      scope: { team: "ops" },
      ops: [{ op: "hide", target: "orders-table" }],
      basis: { contract: 1, core: "0.0.0", manifests: {} },
      source: "manual",
      createdBy: "ana",
      createdAt: "2026-11-19T00:00:00.000Z",
    },
    etag,
    version,
    updatedAt: `2026-11-20T00:00:0${String(version)}.000Z`,
  }
}

describe("memoryOverlayStore", () => {
  it("writes only when the current etag matches", async () => {
    const store = memoryOverlayStore()
    expect(await store.put(key, record("a", 1), "x", by)).toBe(false)
    expect(await store.put(key, record("a", 1), null, by)).toBe(true)
    expect(await store.put(key, record("b", 2), null, by)).toBe(false)
    expect(await store.put(key, record("b", 2), "a", by)).toBe(true)
    expect(await store.put(key, record("c", 3), "a", by)).toBe(false)
    expect(await store.get(key)).toEqual(record("b", 2))
  })

  it("keeps its records apart from the objects it is given and returns", async () => {
    const store = memoryOverlayStore()
    const sent = record("a", 1)
    await store.put(key, sent, null, by)
    sent.overlay.ops.length = 0
    const got = await store.get(key)
    got?.overlay.ops.splice(0)
    expect(await store.get(key)).toEqual(record("a", 1))
  })

  it("keeps keys in different scopes apart", async () => {
    const store = memoryOverlayStore()
    await store.put(key, record("a", 1), null, by)
    const other = { ...key, scope: "sales" }
    expect(await store.get(other)).toBeUndefined()
    expect(
      await store.list({ scopes: [{ layer: "team", scope: "sales" }] })
    ).toEqual([])
    expect(await store.put(other, record("b", 1), null, by)).toBe(true)
  })

  it("returns who stored each version in history", async () => {
    const store = memoryOverlayStore()
    await store.put(key, record("a", 1), null, { by: "ana" })
    await store.put(key, record("b", 2), "a", { by: "ben" })
    const history = await store.history?.({
      scopes: [{ layer: "team", scope: "ops" }],
    })
    expect(history).toEqual([
      { record: record("a", 1), by: "ana" },
      { record: record("b", 2), by: "ben" },
    ])
  })

  it("returns every version in history, oldest first", async () => {
    const store = memoryOverlayStore()
    await store.put(key, record("a", 1), null, by)
    await store.put(key, record("b", 2), "a", by)
    const earlier = { ...record("e", 1), updatedAt: "2026-11-19T12:00:00.000Z" }
    await store.put({ ...key, surface: "/users" }, earlier, null, by)
    const query = {
      scopes: [{ layer: "team", scope: "ops" }] as const,
      surfaces: ["/orders"],
    }
    const records = async (surfaces: string[]) =>
      (await store.history?.({ ...query, surfaces }))?.map(
        (version) => version.record
      )
    expect(await records(["/orders", "/users"])).toEqual([
      earlier,
      record("a", 1),
      record("b", 2),
    ])
    expect(await records(["/orders"])).toEqual([record("a", 1), record("b", 2)])
    expect(await store.list(query)).toEqual([record("b", 2)])
    expect(await store.list({ ...query, surfaces: ["/accounts"] })).toEqual([])
  })
})
