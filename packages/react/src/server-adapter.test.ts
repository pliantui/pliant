import { describe, expect, it, vi } from "vitest"

import type { Overlay, StoredOverlay } from "@pliantui/contract"

import { serverAdapter } from "./server-adapter"
import { StorageConflictError } from "./storage-conflict-error"

const p1 = "01KAB0000000000000000000P1"

function overlay(extra: Partial<Overlay> = {}): Overlay {
  return {
    v: 1,
    id: p1,
    surface: "/orders",
    layer: "personal",
    ops: [{ op: "hide", target: "orders-table/columns/total" }],
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "manual",
    createdBy: "local",
    createdAt: "2026-11-19T00:00:00.000Z",
    ...extra,
  } as Overlay
}

const record: StoredOverlay = {
  overlay: overlay(),
  etag: "01KAB00000000000000000ETAG",
  version: 1,
  updatedAt: "2026-11-20T00:00:00.000Z",
}

function adapterAnswering(status: number, body?: unknown, endpoint = "/s") {
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    Promise.resolve(
      body === undefined
        ? new Response(null, { status })
        : Response.json(body, { status })
    )
  )
  return { adapter: serverAdapter({ endpoint, fetch }), fetch }
}

function requestOf(fetch: ReturnType<typeof adapterAnswering>["fetch"]) {
  const [input, init] = fetch.mock.calls[0] ?? []
  return {
    url: typeof input === "string" ? input : "",
    init: init ?? {},
    headers: new Headers(init?.headers),
  }
}

async function rejectionOf(promise: unknown) {
  return Promise.resolve(promise).then(
    () => {
      throw new Error("Expected a rejection")
    },
    (error: unknown) => error
  )
}

describe("serverAdapter", () => {
  it("loads a surface without the HTTP cache", async () => {
    const { adapter, fetch } = adapterAnswering(200, {
      org: [],
      team: [],
      personal: [record],
    })
    expect(await adapter.load("/orders")).toEqual({
      org: [],
      team: [],
      personal: [record],
    })
    const { url, init } = requestOf(fetch)
    expect(url).toBe("/s?surface=%2Forders")
    expect(init.cache).toBe("no-store")
  })

  it("skips records that aren't valid when loading", async () => {
    const { adapter } = adapterAnswering(200, {
      personal: [record, { ...record, version: 0 }],
    })
    expect(await adapter.load("/orders")).toEqual({
      org: [],
      team: [],
      personal: [record],
    })
  })

  it("adds its parameters to an endpoint that has a query string", async () => {
    const { adapter, fetch } = adapterAnswering(200, {}, "/s?app=1")
    await adapter.load("/orders")
    expect(requestOf(fetch).url).toBe("/s?app=1&surface=%2Forders")
  })

  it("creates a record with If-None-Match and replaces one with If-Match", async () => {
    const create = adapterAnswering(201, record)
    expect(
      await create.adapter.save("/orders", overlay(), { ifMatch: null })
    ).toEqual(record)
    const created = requestOf(create.fetch)
    expect(created.init.method).toBe("PUT")
    expect(created.headers.get("if-none-match")).toBe("*")
    expect(created.headers.get("if-match")).toBeNull()
    expect(created.headers.get("content-type")).toBe("application/json")
    expect(created.init.keepalive).toBe(true)

    const replace = adapterAnswering(200, record)
    await replace.adapter.save("/orders", overlay(), { ifMatch: "e1" })
    const replaced = requestOf(replace.fetch)
    expect(replaced.headers.get("if-match")).toBe('"e1"')
    expect(replaced.headers.get("if-none-match")).toBeNull()
  })

  it("sends a save over 64 KiB without keepalive", async () => {
    const { adapter, fetch } = adapterAnswering(201, record)
    await adapter.save("/orders", overlay({ explain: ["x".repeat(70_000)] }), {
      ifMatch: null,
    })
    expect(requestOf(fetch).init.keepalive).toBe(false)
  })

  it("keeps the keepalive saves in flight under 64 KiB together", async () => {
    const answers: (() => void)[] = []
    const fetch = vi.fn<typeof globalThis.fetch>(
      () =>
        new Promise((resolve) => {
          answers.push(() => {
            resolve(Response.json(record, { status: 201 }))
          })
        })
    )
    const adapter = serverAdapter({ endpoint: "/s", fetch })
    const big = overlay({ explain: ["x".repeat(40_000)] })
    const first = adapter.save("/orders", big, { ifMatch: null })
    const second = adapter.save("/orders", big, { ifMatch: null })
    for (const answer of answers) {
      answer()
    }
    await Promise.all([first, second])
    const third = adapter.save("/orders", big, { ifMatch: null })
    answers.at(-1)?.()
    await third
    expect(fetch.mock.calls.map(([, init]) => init?.keepalive)).toEqual([
      true,
      false,
      true,
    ])
  })

  it("rejects with a StorageConflictError carrying the current record on 412", async () => {
    const { adapter } = adapterAnswering(412, { current: record })
    const error = await rejectionOf(
      adapter.save("/orders", overlay(), { ifMatch: null })
    )
    expect(error).toBeInstanceOf(StorageConflictError)
    expect((error as StorageConflictError).current).toEqual(record)
  })

  it("rejects with a conflict without a record when there is none", async () => {
    const { adapter } = adapterAnswering(412, { current: null })
    const error = await rejectionOf(
      adapter.remove?.("/orders", p1, { ifMatch: "e1" })
    )
    expect(error).toBeInstanceOf(StorageConflictError)
    expect((error as StorageConflictError).current).toBeUndefined()
  })

  it("rejects with a plain error when a 412 has no valid record", async () => {
    const { adapter } = adapterAnswering(412, { current: { etag: 1 } })
    const error = await rejectionOf(
      adapter.save("/orders", overlay(), { ifMatch: null })
    )
    expect(error).not.toBeInstanceOf(StorageConflictError)
    expect(error).toBeInstanceOf(Error)
  })

  it("rejects with the status and message of any other failure", async () => {
    const { adapter } = adapterAnswering(403, { message: "Not allowed" })
    await expect(
      adapter.save("/orders", overlay(), { ifMatch: null })
    ).rejects.toThrow("Storage answered 403: Not allowed")
    const empty = adapterAnswering(500)
    await expect(
      Promise.resolve(empty.adapter.load("/orders"))
    ).rejects.toThrow(/500/)
  })

  it("rejects a save answered without a valid record", async () => {
    const { adapter } = adapterAnswering(200, { etag: "e" })
    await expect(
      adapter.save("/orders", overlay(), { ifMatch: null })
    ).rejects.toThrow()
  })

  it("removes with If-Match and keepalive", async () => {
    const { adapter, fetch } = adapterAnswering(204)
    await adapter.remove?.("/orders", p1, { ifMatch: "e1" })
    const { url, init, headers } = requestOf(fetch)
    expect(url).toBe(`/s?surface=%2Forders&id=${p1}`)
    expect(init.method).toBe("DELETE")
    expect(init.keepalive).toBe(true)
    expect(headers.get("if-match")).toBe('"e1"')
  })

  it("reads history and lists through the query string", async () => {
    const history = adapterAnswering(200, { records: [record] })
    expect(await history.adapter.history?.("/orders", p1)).toEqual([record])
    expect(requestOf(history.fetch).url).toBe(
      `/s?surface=%2Forders&history=&id=${p1}`
    )
    expect(requestOf(history.fetch).init.cache).toBe("no-store")

    const list = adapterAnswering(200, { records: [record] })
    expect(await list.adapter.list?.("team")).toEqual([record])
    expect(requestOf(list.fetch).url).toBe("/s?layer=team")
  })

  it("has no subscribe", () => {
    expect("subscribe" in serverAdapter({ endpoint: "/s" })).toBe(false)
  })
})
