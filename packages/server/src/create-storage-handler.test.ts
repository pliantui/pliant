import { describe, expect, it, vi } from "vitest"

import {
  storedOverlaySchema,
  type Overlay,
  type StoredOverlay,
} from "@pliantui/contract"

import {
  createStorageHandler,
  type StorageHandlerConfig,
  type StorageUser,
} from "./create-storage-handler"
import { memoryOverlayStore } from "./memory-overlay-store"
import type { OverlayStore } from "./overlay-store"

const p1 = "01KAB0000000000000000000P1"
const url = "http://app.test/storage"
const ana: StorageUser = { id: "ana", org: "acme", teams: ["ops"] }

function overlay(extra: Record<string, unknown> = {}) {
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
  }
}

function handlerFor(config: Partial<StorageHandlerConfig> = {}) {
  return createStorageHandler({
    store: memoryOverlayStore(),
    getUser: () => ana,
    canPublish: () => true,
    ...config,
  })
}

function put(
  body: unknown,
  headers: Record<string, string> = { "if-none-match": "*" },
  surface = "/orders"
) {
  return new Request(`${url}?surface=${encodeURIComponent(surface)}`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

function remove(headers: Record<string, string>, id = p1) {
  return new Request(`${url}?surface=%2Forders&id=${id}`, {
    method: "DELETE",
    headers,
  })
}

async function stored(response: Response) {
  return storedOverlaySchema.parse(await response.json())
}

describe("createStorageHandler", () => {
  it("answers 201 with the record and its etag when it creates one", async () => {
    const response = await handlerFor()(put(overlay()))
    expect(response.status).toBe(201)
    const record = await stored(response)
    expect(response.headers.get("etag")).toBe(`"${record.etag}"`)
    expect(response.headers.get("cache-control")).toBe("no-store")
  })

  it("answers 200 when it replaces a record", async () => {
    const handler = handlerFor()
    const created = await stored(await handler(put(overlay())))
    const response = await handler(
      put(overlay(), { "if-match": `"${created.etag}"` })
    )
    expect(response.status).toBe(200)
  })

  it("answers 412 with a null current record when there is none to replace", async () => {
    const response = await handlerFor()(
      put(overlay(), { "if-match": '"missing"' })
    )
    expect(response.status).toBe(412)
    expect(await response.json()).toEqual({ current: null })
  })

  it("answers 412 when the store loses the race to write", async () => {
    const store = memoryOverlayStore()
    const racing: OverlayStore = {
      ...store,
      put: () => Promise.resolve(false),
    }
    const response = await handlerFor({ store: racing })(put(overlay()))
    expect(response.status).toBe(412)
  })

  it("answers 428 to a write without a precondition", async () => {
    const handler = handlerFor()
    expect((await handler(put(overlay(), {}))).status).toBe(428)
    expect((await handler(remove({}))).status).toBe(428)
  })

  it("answers 400 to a malformed precondition", async () => {
    const handler = handlerFor()
    for (const headers of [
      { "if-match": "unquoted" },
      { "if-match": 'W/"weak"' },
      { "if-match": '"a", "b"' },
      { "if-none-match": '"etag"' },
      { "if-none-match": "*", "if-match": '"etag"' },
    ]) {
      expect((await handler(put(overlay(), headers))).status).toBe(400)
    }
  })

  it("answers 415 to a body that isn't JSON and 400 to one that doesn't parse", async () => {
    const handler = handlerFor()
    const form = new Request(`${url}?surface=%2Forders`, {
      method: "PUT",
      headers: { "if-none-match": "*" },
      body: new URLSearchParams({ id: p1 }),
    })
    expect((await handler(form)).status).toBe(415)
    expect((await handler(put("{"))).status).toBe(400)
  })

  it("answers 413 to a body over 256 KB", async () => {
    const big = overlay({ padding: "x".repeat(262_144) })
    expect((await handlerFor()(put(big))).status).toBe(413)
  })

  it("answers 400 to a session overlay or a surface that isn't valid", async () => {
    const handler = handlerFor()
    expect((await handler(put(overlay({ layer: "session" })))).status).toBe(400)
    expect(
      (
        await handler(
          put(
            overlay({ surface: "Orders" }),
            { "if-none-match": "*" },
            "Orders"
          )
        )
      ).status
    ).toBe(400)
    expect((await handler(new Request(url))).status).toBe(400)
    expect(
      (await handler(new Request(`${url}?surface=%2Forders&history&id=1`)))
        .status
    ).toBe(400)
    expect((await handler(new Request(`${url}?layer=session`))).status).toBe(
      400
    )
    expect(
      (await handler(new Request(`${url}?layer=team&surface=%2Forders`))).status
    ).toBe(400)
  })

  it("keeps a team overlay of another org from members of a team with its id", async () => {
    const handler = handlerFor()
    const response = await handler(
      put(overlay({ layer: "team", scope: { team: "ops", org: "globex" } }))
    )
    expect(response.status).toBe(403)
  })

  it("answers 403 to a publisher outside the team or org", async () => {
    const handler = handlerFor()
    for (const scoped of [
      { layer: "team", scope: { team: "sales" } },
      { layer: "org", scope: { org: "globex" } },
    ]) {
      expect((await handler(put(overlay(scoped)))).status).toBe(403)
    }
  })

  it("keeps teams with the same id in different orgs apart", async () => {
    const store = memoryOverlayStore()
    const acme = handlerFor({ store })
    const globex = handlerFor({
      store,
      getUser: () => ({ id: "cy", org: "globex", teams: ["ops"] }),
    })
    const team = overlay({ layer: "team", scope: { team: "ops" } })
    const ours = await stored(await acme(put(team)))
    const load = new Request(`${url}?surface=%2Forders`)
    expect(await (await globex(load.clone())).json()).toMatchObject({
      team: [],
    })
    const theirs = await globex(put(team))
    expect(theirs.status).toBe(201)
    expect(await (await acme(load.clone())).json()).toMatchObject({
      team: [ours],
    })
  })

  it("keeps a user without an org out of team overlays", async () => {
    const handler = handlerFor({
      getUser: () => ({ id: "dee", teams: ["ops"] }),
    })
    const response = await handler(
      put(overlay({ layer: "team", scope: { team: "ops" } }))
    )
    expect(response.status).toBe(403)
  })

  it("tells the store who saved and removed each record", async () => {
    const store = memoryOverlayStore()
    const ben: StorageUser = { id: "ben", org: "acme", teams: ["ops"] }
    const team = overlay({ layer: "team", scope: { team: "ops" } })
    const created = await stored(await handlerFor({ store })(put(team)))
    const updated = await stored(
      await handlerFor({ store, getUser: () => ben })(
        put(team, { "if-match": `"${created.etag}"` })
      )
    )
    await handlerFor({ store })(remove({ "if-match": `"${updated.etag}"` }))
    const history = await store.history?.({
      scopes: [{ layer: "team", scope: JSON.stringify(["acme", "ops"]) }],
    })
    expect(history?.map((version) => version.by)).toEqual(["ana", "ben", "ana"])
  })

  it("answers history without the authors", async () => {
    const handler = handlerFor()
    const created = await stored(await handler(put(overlay())))
    const response = await handler(
      new Request(`${url}?surface=%2Forders&history`)
    )
    expect(await response.json()).toEqual({ records: [created] })
  })

  it("lets nobody publish without canPublish", async () => {
    const handler = createStorageHandler({
      store: memoryOverlayStore(),
      getUser: () => ana,
    })
    const response = await handler(
      put(overlay({ layer: "org", scope: { org: "acme" } }))
    )
    expect(response.status).toBe(403)
  })

  it("asks canPublish with the user, layer and scope", async () => {
    const canPublish = vi.fn(() => true)
    await handlerFor({ canPublish })(
      put(overlay({ layer: "team", scope: { team: "ops" } }))
    )
    expect(canPublish).toHaveBeenCalledWith(ana, "team", { team: "ops" })
  })

  it("does nothing when another removal wins the race", async () => {
    const store = memoryOverlayStore()
    const created = await stored(await handlerFor({ store })(put(overlay())))
    const racing: OverlayStore = {
      ...store,
      put: async (key, record, ifMatch, options) => {
        await store.put(key, { ...record, etag: "other" }, ifMatch, options)
        return false
      },
    }
    const response = await handlerFor({ store: racing })(
      remove({ "if-match": `"${created.etag}"` })
    )
    expect(response.status).toBe(204)
  })

  it("serves the current records as history from a store without history", async () => {
    const base = memoryOverlayStore()
    const latest: OverlayStore = {
      get: (key) => base.get(key),
      put: (key, record, ifMatch, options) =>
        base.put(key, record, ifMatch, options),
      list: (query) => base.list(query),
    }
    const handler = handlerFor({ store: latest })
    const first = await stored(await handler(put(overlay())))
    const second = await stored(
      await handler(put(overlay(), { "if-match": `"${first.etag}"` }))
    )
    const response = await handler(
      new Request(`${url}?surface=%2Forders&history`)
    )
    expect(await response.json()).toEqual({ records: [second] })
  })

  it("does nothing when removing an overlay that isn't stored", async () => {
    const response = await handlerFor()(remove({ "if-match": '"etag"' }))
    expect(response.status).toBe(204)
  })

  it("answers 405 with the allowed methods", async () => {
    const response = await handlerFor()(new Request(url, { method: "POST" }))
    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("GET, PUT, DELETE")
  })

  it("answers 500 and reports the error when the store fails", async () => {
    const onError = vi.fn()
    const failing: OverlayStore = {
      ...memoryOverlayStore(),
      list: () => Promise.reject(new Error("offline")),
    }
    const response = await handlerFor({ store: failing, onError })(
      new Request(`${url}?surface=%2Forders`)
    )
    expect(response.status).toBe(500)
    expect(onError).toHaveBeenCalledWith(new Error("offline"))
  })

  it("lists a layer's records on every surface, tombstones included", async () => {
    const handler = handlerFor()
    const orders = await stored(await handler(put(overlay())))
    const users = await stored(
      await handler(
        put(
          overlay({ id: "01KAB0000000000000000000P2", surface: "/users" }),
          { "if-none-match": "*" },
          "/users"
        )
      )
    )
    await handler(remove({ "if-match": `"${orders.etag}"` }))
    const response = await handler(new Request(`${url}?layer=personal`))
    const { records } = (await response.json()) as {
      records: StoredOverlay[]
    }
    expect(records.map((record) => record.overlay.surface).sort()).toEqual([
      "/orders",
      "/users",
    ])
    expect(records.find((record) => record.deletedAt)?.version).toBe(2)
    expect(records).toContainEqual(users)
  })

  it("stores the overlay as sent, unknown fields included", async () => {
    const sent = overlay({ future: { kept: true } }) as unknown as Overlay
    const record = await stored(await handlerFor()(put(sent)))
    expect(record.overlay).toEqual(sent)
  })
})
