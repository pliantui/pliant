import { expect, it } from "vitest"

import type { StoredOverlay } from "@pliantui/contract"

import type { OverlayKey, OverlayStore } from "./overlay-store"

const by = { by: "ana" }

export const key: OverlayKey = {
  surface: "/orders",
  layer: "team",
  scope: JSON.stringify(["acme", "ops"]),
  id: "01KAB0000000000000000000P1",
}

const ops = [{ layer: "team", scope: key.scope }] as const

export function record(etag: string, version: number): StoredOverlay {
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

/**
 * The behaviour every `OverlayStore` must have. Call it inside a `describe`
 * with a function that returns an empty store.
 */
export function testOverlayStore(create: () => Promise<OverlayStore>) {
  it("writes only when the current etag matches", async () => {
    const store = await create()
    expect(await store.put(key, record("a", 1), "x", by)).toBe(false)
    expect(await store.put(key, record("a", 1), null, by)).toBe(true)
    expect(await store.put(key, record("b", 2), null, by)).toBe(false)
    expect(await store.put(key, record("b", 2), "a", by)).toBe(true)
    expect(await store.put(key, record("c", 3), "a", by)).toBe(false)
    expect(await store.get(key)).toEqual(record("b", 2))
  })

  it("lets exactly one of two racing creates win", async () => {
    const store = await create()
    const results = await Promise.all([
      store.put(key, record("a", 1), null, { by: "ana" }),
      store.put(key, record("b", 1), null, { by: "ben" }),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    const winner = results[0] ? record("a", 1) : record("b", 1)
    expect(await store.get(key)).toEqual(winner)
    expect(
      (await store.history?.({ scopes: ops }))?.map((entry) => entry.record)
    ).toEqual([winner])
  })

  it("lets exactly one of two racing updates win", async () => {
    const store = await create()
    await store.put(key, record("a", 1), null, by)
    const results = await Promise.all([
      store.put(key, record("b", 2), "a", { by: "ana" }),
      store.put(key, record("c", 2), "a", { by: "ben" }),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    const winner = results[0] ? record("b", 2) : record("c", 2)
    expect(await store.get(key)).toEqual(winner)
    expect(
      (await store.history?.({ scopes: ops }))?.map((entry) => entry.record)
    ).toEqual([record("a", 1), winner])
  })

  it("keeps its records apart from the objects it is given and returns", async () => {
    const store = await create()
    const sent = record("a", 1)
    await store.put(key, sent, null, by)
    sent.overlay.ops.length = 0
    const got = await store.get(key)
    got?.overlay.ops.splice(0)
    expect(await store.get(key)).toEqual(record("a", 1))
  })

  it("keeps keys in different scopes apart", async () => {
    const store = await create()
    await store.put(key, record("a", 1), null, by)
    const other = { ...key, scope: JSON.stringify(["acme", "sales"]) }
    expect(await store.get(other)).toBeUndefined()
    expect(
      await store.list({ scopes: [{ layer: "team", scope: other.scope }] })
    ).toEqual([])
    expect(
      await store.list({ scopes: [{ layer: "org", scope: key.scope }] })
    ).toEqual([])
    expect(await store.put(other, record("b", 1), null, by)).toBe(true)
    expect(await store.get(key)).toEqual(record("a", 1))
  })

  it("returns nothing for a query without scopes", async () => {
    const store = await create()
    await store.put(key, record("a", 1), null, by)
    expect(await store.list({ scopes: [] })).toEqual([])
    expect((await store.history?.({ scopes: [] })) ?? []).toEqual([])
  })

  it("lists the current records of any of the given scopes, surfaces and id", async () => {
    const store = await create()
    const personal = {
      ...key,
      layer: "personal",
      scope: "ana",
      id: "01KAB0000000000000000000P2",
    } as const
    const mine = { ...record("p", 1), updatedAt: "2026-11-19T00:00:00.000Z" }
    await store.put(key, record("a", 1), null, by)
    await store.put(personal, mine, null, by)
    await store.put({ ...personal, surface: "/users" }, mine, null, by)
    const scopes = [...ops, { layer: "personal", scope: "ana" }] as const
    const listed = await store.list({ scopes, surfaces: ["/orders"] })
    expect(listed).toHaveLength(2)
    expect(listed).toEqual(expect.arrayContaining([record("a", 1), mine]))
    expect(await store.list({ scopes, id: personal.id })).toEqual([mine, mine])
    expect(await store.list({ scopes, surfaces: [] })).toEqual([])
  })

  it("keeps tombstones and returns them like any record", async () => {
    const store = await create()
    const removed = { ...record("b", 2), deletedAt: "2026-11-20T00:00:02.000Z" }
    await store.put(key, record("a", 1), null, by)
    expect(await store.put(key, removed, "a", by)).toBe(true)
    expect(await store.put(key, record("c", 1), null, by)).toBe(false)
    expect(await store.get(key)).toEqual(removed)
    expect(await store.list({ scopes: ops })).toEqual([removed])
    expect(
      (await store.history?.({ scopes: ops }))?.map((entry) => entry.record)
    ).toEqual([record("a", 1), removed])
  })

  it("returns who stored each version in history", async () => {
    const store = await create()
    await store.put(key, record("a", 1), null, { by: "ana" })
    await store.put(key, record("b", 2), "a", { by: "ben" })
    expect(await store.history?.({ scopes: ops })).toEqual([
      { record: record("a", 1), by: "ana" },
      { record: record("b", 2), by: "ben" },
    ])
  })

  it("returns every version in history, oldest first", async () => {
    const store = await create()
    await store.put(key, record("a", 1), null, by)
    await store.put(key, record("b", 2), "a", by)
    const earlier = { ...record("e", 1), updatedAt: "2026-11-19T12:00:00.000Z" }
    await store.put({ ...key, surface: "/users" }, earlier, null, by)
    const query = { scopes: ops, surfaces: ["/orders"] }
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

  it("orders versions stored at the same time by version, then overlay id", async () => {
    const store = await create()
    const at = (etag: string, version: number, id: string) => {
      const base = record(etag, version)
      return {
        ...base,
        overlay: { ...base.overlay, id },
        updatedAt: "2026-11-20T00:00:00.000Z",
      }
    }
    const b = at("b", 1, "01KAB0000000000000000000PB")
    const a = at("a", 1, "01KAB0000000000000000000PA")
    const a2 = at("a2", 2, "01KAB0000000000000000000PA")
    await store.put({ ...key, id: b.overlay.id }, b, null, by)
    await store.put({ ...key, id: a.overlay.id }, a, null, by)
    await store.put({ ...key, id: a.overlay.id }, a2, "a", by)
    expect(
      (await store.history?.({ scopes: ops }))?.map((entry) => entry.record)
    ).toEqual([a, b, a2])
  })
}
