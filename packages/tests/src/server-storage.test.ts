import { describe, expect, it } from "vitest"

import type { Overlay } from "@pliantui/contract"
import { StorageConflictError } from "@pliantui/react"
import { serverAdapter } from "@pliantui/react/server-adapter"
import {
  createStorageHandler,
  memoryOverlayStore,
  type StorageUser,
} from "@pliantui/server/storage"

interface User extends StorageUser {
  readonly admin?: boolean
  readonly leads?: readonly string[]
}

const users: Record<string, User> = {
  ana: { id: "ana", org: "acme", teams: ["ops"], admin: true, leads: ["ops"] },
  ben: { id: "ben", org: "acme", teams: ["ops"] },
  cy: { id: "cy", org: "globex", teams: ["sales"] },
}

const p1 = "01KAB0000000000000000000P1"
const p2 = "01KAB0000000000000000000P2"
const p3 = "01KAB0000000000000000000P3"
const endpoint = "http://app.test/api/pliant/storage"

function overlay(
  id: string,
  width: number,
  extra: Partial<Overlay> = {}
): Overlay {
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
    ...extra,
  } as Overlay
}

const team = (id: string, width: number) =>
  overlay(id, width, { layer: "team", scope: { team: "ops" } })
const org = (id: string, width: number) =>
  overlay(id, width, { layer: "org", scope: { org: "acme" } })

function setup() {
  let time = Date.parse("2026-11-20T00:00:00.000Z")
  const handler = createStorageHandler<User>({
    store: memoryOverlayStore(),
    getUser: (request) => users[request.headers.get("x-user") ?? ""] ?? null,
    canPublish: (user, target) =>
      target.layer === "org"
        ? user.admin === true
        : (user.leads ?? []).includes(target.team),
    now: () => new Date((time += 1000)),
  })
  function as(user: string) {
    return serverAdapter({
      endpoint,
      fetch: (input, init) => {
        const headers = new Headers(init?.headers)
        headers.set("x-user", user)
        return handler(
          new Request(input instanceof Request ? input.url : input, {
            ...init,
            headers,
          })
        )
      },
    })
  }
  return { handler, as }
}

async function conflictOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (cause: unknown) => cause
  )
  expect(error).toBeInstanceOf(StorageConflictError)
  return error as StorageConflictError
}

describe("serverAdapter with createStorageHandler", () => {
  it("saves an overlay and loads it back", async () => {
    const ana = setup().as("ana")
    const record = await ana.save("/orders", overlay(p1, 120), {
      ifMatch: null,
    })
    expect(record.overlay).toEqual(overlay(p1, 120))
    expect(await ana.load("/orders")).toEqual({
      org: [],
      team: [],
      personal: [record],
    })
  })

  it("assigns the etag, version and timestamps on the server", async () => {
    const ana = setup().as("ana")
    const first = await ana.save("/orders", overlay(p1, 120), {
      ifMatch: null,
    })
    const second = await ana.save("/orders", overlay(p1, 120), {
      ifMatch: first.etag,
    })
    expect(first).toMatchObject({
      version: 1,
      updatedAt: "2026-11-20T00:00:01.000Z",
    })
    expect(second).toMatchObject({
      version: 2,
      updatedAt: "2026-11-20T00:00:02.000Z",
    })
    expect(second.etag).not.toBe(first.etag)
  })

  it("rejects an etag, version or timestamp the client sends", async () => {
    const { handler } = setup()
    const response = await handler(
      new Request(`${endpoint}?surface=%2Forders`, {
        method: "PUT",
        headers: {
          "x-user": "ana",
          "content-type": "application/json",
          "if-none-match": "*",
        },
        body: JSON.stringify({
          overlay: overlay(p1, 120),
          etag: "chosen",
          version: 40,
          updatedAt: "2020-01-01T00:00:00.000Z",
        }),
      })
    )
    expect(response.status).toBe(400)
  })

  it("rejects a create-only save when the overlay is stored", async () => {
    const ana = setup().as("ana")
    const first = await ana.save("/orders", overlay(p1, 120), {
      ifMatch: null,
    })
    const error = await conflictOf(
      Promise.resolve(ana.save("/orders", overlay(p1, 200), { ifMatch: null }))
    )
    expect(error.current).toEqual(first)
  })

  it("rejects a save with a stale etag and returns the current record", async () => {
    const ana = setup().as("ana")
    const first = await ana.save("/orders", overlay(p1, 120), {
      ifMatch: null,
    })
    const second = await ana.save("/orders", overlay(p1, 160), {
      ifMatch: first.etag,
    })
    const error = await conflictOf(
      Promise.resolve(
        ana.save("/orders", overlay(p1, 200), { ifMatch: first.etag })
      )
    )
    expect(error.current).toEqual(second)
  })

  it("never accepts an old etag when the content returns to an old value", async () => {
    const ana = setup().as("ana")
    const a = await ana.save("/orders", overlay(p1, 120), { ifMatch: null })
    const b = await ana.save("/orders", overlay(p1, 160), { ifMatch: a.etag })
    const again = await ana.save("/orders", overlay(p1, 120), {
      ifMatch: b.etag,
    })
    expect(again.etag).not.toBe(a.etag)
    const error = await conflictOf(
      Promise.resolve(
        ana.save("/orders", overlay(p1, 120), { ifMatch: a.etag })
      )
    )
    expect(error.current).toEqual(again)
  })

  it("removes an overlay with a tombstone that blocks saving it again", async () => {
    const ana = setup().as("ana")
    const record = await ana.save("/orders", overlay(p1, 120), {
      ifMatch: null,
    })
    await ana.remove?.("/orders", p1, { ifMatch: record.etag })
    expect((await ana.load("/orders")).personal).toEqual([])

    const [, tombstone] = (await ana.history?.("/orders", p1)) ?? []
    expect(tombstone).toMatchObject({
      overlay: record.overlay,
      version: 2,
      deletedAt: tombstone?.updatedAt,
    })
    for (const ifMatch of [null, record.etag, tombstone?.etag ?? ""]) {
      const error = await conflictOf(
        Promise.resolve(ana.save("/orders", overlay(p1, 120), { ifMatch }))
      )
      expect(error.current).toEqual(tombstone)
    }
    await ana.remove?.("/orders", p1, { ifMatch: tombstone?.etag ?? "" })
    expect(await ana.history?.("/orders", p1)).toHaveLength(2)
  })

  it("rejects a removal with a stale etag", async () => {
    const ana = setup().as("ana")
    const first = await ana.save("/orders", overlay(p1, 120), {
      ifMatch: null,
    })
    const second = await ana.save("/orders", overlay(p1, 160), {
      ifMatch: first.etag,
    })
    const error = await conflictOf(
      Promise.resolve(ana.remove?.("/orders", p1, { ifMatch: first.etag }))
    )
    expect(error.current).toEqual(second)
    expect((await ana.load("/orders")).personal).toEqual([second])
  })

  it("keeps each user's personal overlays to themselves", async () => {
    const { as } = setup()
    await as("ana").save("/orders", overlay(p1, 120), { ifMatch: null })
    const ben = await as("ben").save("/orders", overlay(p1, 200), {
      ifMatch: null,
    })
    expect((await as("ben").load("/orders")).personal).toEqual([ben])
    expect(await as("ben").list?.("personal")).toEqual([ben])
  })

  it("shows team and org overlays to their members only", async () => {
    const { as } = setup()
    const forTeam = await as("ana").save("/orders", team(p1, 120), {
      ifMatch: null,
    })
    const forOrg = await as("ana").save("/orders", org(p2, 160), {
      ifMatch: null,
    })
    expect(await as("ben").load("/orders")).toEqual({
      org: [forOrg],
      team: [forTeam],
      personal: [],
    })
    expect(await as("cy").load("/orders")).toEqual({
      org: [],
      team: [],
      personal: [],
    })
    expect(await as("cy").history?.("/orders")).toEqual([])
  })

  it("answers 403 to a member who can't publish to the team or org", async () => {
    const { as } = setup()
    const ben = as("ben")
    await expect(
      ben.save("/orders", team(p1, 120), { ifMatch: null })
    ).rejects.toThrow(/403/)
    await expect(
      ben.save("/orders", org(p2, 120), { ifMatch: null })
    ).rejects.toThrow(/403/)

    const published = await as("ana").save("/orders", team(p3, 120), {
      ifMatch: null,
    })
    await expect(
      ben.remove?.("/orders", p3, { ifMatch: published.etag })
    ).rejects.toThrow(/403/)
    expect((await ben.load("/orders")).team).toEqual([published])
  })

  it("answers 403 to a save to a team or org the user isn't in", async () => {
    const cy = setup().as("cy")
    await expect(
      cy.save("/orders", team(p1, 120), { ifMatch: null })
    ).rejects.toThrow(/403/)
    await expect(
      cy.save("/orders", org(p2, 120), { ifMatch: null })
    ).rejects.toThrow(/403/)
  })

  it("answers 401 without a signed-in user", async () => {
    const nobody = setup().as("nobody")
    await expect(Promise.resolve(nobody.load("/orders"))).rejects.toThrow(/401/)
    await expect(
      Promise.resolve(
        nobody.save("/orders", overlay(p1, 120), { ifMatch: null })
      )
    ).rejects.toThrow(/401/)
  })

  it("answers 400 to an overlay that isn't valid", async () => {
    const ana = setup().as("ana")
    await expect(
      Promise.resolve(
        ana.save("/orders", { ...overlay(p1, 120), ops: [] }, { ifMatch: null })
      )
    ).rejects.toThrow(/400/)
    await expect(
      Promise.resolve(
        ana.save("/orders", overlay(p1, 120, { surface: "/users" }), {
          ifMatch: null,
        })
      )
    ).rejects.toThrow(/400/)
    expect((await ana.load("/orders")).personal).toEqual([])
  })

  it("returns every version and tombstone in history, oldest first", async () => {
    const ana = setup().as("ana")
    const a1 = await ana.save("/orders", overlay(p1, 120), { ifMatch: null })
    const b1 = await ana.save("/orders", overlay(p2, 90), { ifMatch: null })
    const a2 = await ana.save("/orders", overlay(p1, 160), {
      ifMatch: a1.etag,
    })
    await ana.remove?.("/orders", p2, { ifMatch: b1.etag })
    const history = (await ana.history?.("/orders")) ?? []
    expect(
      history.map(({ overlay, version, deletedAt }) => [
        overlay.id,
        version,
        deletedAt !== undefined,
      ])
    ).toEqual([
      [p1, 1, false],
      [p2, 1, false],
      [p1, 2, false],
      [p2, 2, true],
    ])
    expect(await ana.history?.("/orders", p1)).toEqual([a1, a2])
  })

  it("loads the @app overlays with every surface", async () => {
    const ana = setup().as("ana")
    const app = await ana.save(
      "/orders",
      overlay(p1, 120, {
        surface: "@app",
        ops: [{ op: "setTextScale", target: "@app", scale: 1.25 }],
      }),
      { ifMatch: null }
    )
    expect((await ana.load("/users")).personal).toEqual([app])
  })
})
