import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { opSchema, type Op } from "@pliantui/contract"
import { resolveRegion } from "@pliantui/core"

import { memoryStorage } from "../test/storage"
import { createLayerStore } from "./layer-store"
import { differingProperties, viewOf } from "./resolved-view"

const surface = "/orders"
const nodes = ["dashboard", "a", "b", "c", "d"]

function parse(op: unknown): Op {
  return opSchema.parse(op)
}

const wrapBox = parse({
  op: "wrap",
  target: "dashboard",
  id: "box",
  items: ["a", "b"],
  mode: "row",
})
const into = (item: string, container: string) =>
  parse({
    op: "move",
    target: `dashboard/slots/${item}`,
    to: { into: container },
  })
const width = (value: number) =>
  parse({
    op: "setColumnWidth",
    target: "orders-table/columns/total",
    width: value,
  })

function answer(ops: Op[]) {
  return {
    v: 1,
    id: "01KAB0000000000000000000S1",
    surface,
    layer: "session",
    ops,
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "ai",
    createdBy: "user-1",
    createdAt: "2026-11-19T00:00:00.000Z",
  }
}

async function setup() {
  const { storage, saved } = memoryStorage()
  const store = createLayerStore({ surface, storage })
  store.connect()
  store.registerNodes(nodes)
  await Promise.resolve()
  return { store, saved }
}

function containers(store: Awaited<ReturnType<typeof setup>>["store"]) {
  return Object.fromEntries(
    [...store.getResolved().placements].map(([id, { container }]) => [
      id,
      container,
    ])
  )
}

function lockInKeepsTheView(store: Awaited<ReturnType<typeof setup>>["store"]) {
  const before = viewOf(store.getResolved())
  const result = store.actions.lockIn()
  expect(result.success).toBe(true)
  expect([...differingProperties(before, viewOf(store.getResolved()))]).toEqual(
    []
  )
  return result
}

beforeEach(() => {
  sessionStorage.clear()
})

describe("lockIn", () => {
  describe("lang", () => {
    afterEach(() => {
      document.documentElement.removeAttribute("lang")
    })

    it("records the page's language when the preview has none", async () => {
      document.documentElement.lang = "fr-CA"
      const { store, saved } = await setup()
      store.actions.preview(answer([width(320)]))

      expect(store.actions.lockIn()).toMatchObject({
        overlay: { lang: "fr-CA" },
      })
      expect(saved).toMatchObject([{ lang: "fr-CA" }])
    })

    it("keeps the preview's own language", async () => {
      document.documentElement.lang = "fr-CA"
      const { store } = await setup()
      store.actions.preview({ ...answer([width(320)]), lang: "de" })

      expect(store.actions.lockIn()).toMatchObject({ overlay: { lang: "de" } })
    })
  })

  it("keeps a session wrap that a locked move would drop", async () => {
    const { store, saved } = await setup()
    store.actions.applyOps("session", [wrapBox])
    store.actions.preview(answer([into("a", "d")]))
    expect(containers(store)).toEqual({ a: "d", b: "box" })

    expect(lockInKeepsTheView(store)).toEqual({
      success: true,
      overlay: null,
      keptInSession: [into("a", "d")],
    })
    expect(containers(store)).toEqual({ a: "d", b: "box" })
    expect(saved).toEqual([])
  })

  it("keeps session moves into a node a session wrap creates", async () => {
    const { store } = await setup()
    store.actions.applyOps("session", [wrapBox])
    store.actions.applyOps("session", [into("c", "box")])
    store.actions.preview(answer([into("a", "d")]))
    expect(containers(store)).toEqual({ a: "d", b: "box", c: "box" })

    lockInKeepsTheView(store)
    expect(containers(store)).toEqual({ a: "d", b: "box", c: "box" })
    expect(store.getResolved().unapplied).toEqual([])
  })

  it("keeps a move into a node a session wrap creates", async () => {
    const { store, saved } = await setup()
    store.actions.applyOps("session", [wrapBox])
    store.actions.preview(answer([width(320), into("c", "box")]))

    expect(lockInKeepsTheView(store)).toMatchObject({
      overlay: { ops: [width(320)] },
      keptInSession: [into("c", "box")],
    })
    expect(saved).toMatchObject([{ ops: [width(320)] }])
    expect(containers(store)).toMatchObject({ c: "box" })
  })

  it("locks in what it can from a mixed preview", async () => {
    const { store, saved } = await setup()
    const page = parse({ op: "setPage", target: "orders-table", index: 2 })
    const hide = parse({ op: "hide", target: "c" })
    store.actions.applyOps("session", [wrapBox])
    store.actions.applyOps("session", [width(100)])
    store.actions.preview(answer([width(320), into("a", "d"), page, hide]))

    expect(lockInKeepsTheView(store)).toMatchObject({
      overlay: { layer: "personal", ops: [width(320), hide] },
      keptInSession: [into("a", "d"), page],
    })
    expect(saved).toHaveLength(1)
  })

  it("keeps the session moves an item's old place anchors", async () => {
    const { store } = await setup()
    const after = (item: string, anchor: string) =>
      parse({
        op: "move",
        target: `dashboard/slots/${item}`,
        to: { after: anchor },
      })
    store.actions.applyOps("session", [after("a", "c"), after("b", "a")])
    store.actions.preview(answer([into("a", "d")]))
    const order = () =>
      resolveRegion(store.getResolved(), {
        id: "dashboard",
        slots: ["b", "a", "c", "d"],
      }).entries.map(({ id }) => id)
    expect(order()).toEqual(["c", "b", "d"])

    expect(lockInKeepsTheView(store)).toEqual({
      success: true,
      overlay: null,
      keptInSession: [into("a", "d")],
    })
    expect(order()).toEqual(["c", "b", "d"])
  })

  it("keeps ops in session when the personal version wouldn't validate", async () => {
    const { store, saved } = await setup()
    const pair = parse({
      op: "wrap",
      target: "dashboard",
      id: "pair",
      items: ["c", "d"],
      mode: "row",
    })
    const remove = parse({ op: "remove", target: "pair" })
    store.actions.applyOps("personal", [pair])
    store.flush()
    store.actions.preview(answer([remove, into("a", "pair")]))

    expect(lockInKeepsTheView(store)).toEqual({
      success: true,
      overlay: null,
      keptInSession: [remove, into("a", "pair")],
    })
    expect(saved).toHaveLength(1)
    expect(containers(store)).toMatchObject({ a: "pair" })
  })

  it("keeps ops in session when the rest wouldn't validate on top", async () => {
    const stored = (id: string, ops: unknown[], second: number) => ({
      ...answer([]),
      id,
      layer: "personal",
      ops,
      createdAt: `2026-11-18T00:00:0${String(second)}.000Z`,
    })
    const insert = (target: string, dataset: string) =>
      parse({
        op: "insert",
        target,
        node: { id: "ins1", kind: "chart", dataset },
        at: { index: 0 },
      })
    const store = createLayerStore({
      surface,
      storage: memoryStorage({
        personal: [
          stored("01KAB0000000000000000000P1", [insert("dashboard", "a")], 1),
          stored(
            "01KAB0000000000000000000P2",
            [{ op: "remove", target: "ins1" }],
            2
          ),
        ],
      }).storage,
    })
    store.connect()
    store.registerNodes(["dashboard", "sidebar", "a", "c"])
    await Promise.resolve()
    store.actions.applyOps("session", [
      parse({
        op: "wrap",
        target: "sidebar",
        id: "box",
        items: ["c", "e"],
        mode: "stack",
      }),
    ])
    const preview = [insert("box", "orders"), into("a", "ins1")]
    expect(store.actions.preview(answer(preview)).success).toBe(true)

    expect(lockInKeepsTheView(store)).toEqual({
      success: true,
      overlay: null,
      keptInSession: preview,
    })
  })
})
