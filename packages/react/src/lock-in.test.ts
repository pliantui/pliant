import { beforeEach, describe, expect, it } from "vitest"

import { opSchema, type Op } from "@pliantui/contract"

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
  const saved: unknown[] = []
  const store = createLayerStore({
    surface,
    storage: {
      load: () => ({}),
      save: (_surface, overlay) => {
        saved.push(overlay)
      },
    },
  })
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

  it("never changes the resolved view", async () => {
    let seed = 7
    function random(max: number) {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648
      return Math.floor(seed / 65_536) % max
    }
    function pick<T>(items: readonly T[]): T {
      const item = items[random(items.length)]
      if (item === undefined) {
        throw new Error("empty")
      }
      return item
    }
    const pool = () => [
      wrapBox,
      parse({
        op: "wrap",
        target: "dashboard",
        id: "pair",
        items: ["c", "d"],
        mode: "stack",
      }),
      into(pick(["a", "b", "c"]), pick(["box", "pair", "d"])),
      parse({
        op: "pin",
        target: `dashboard/slots/${pick(["a", "b", "c"])}`,
        where: "start",
      }),
      parse({
        op: pick(["hide", "show"]),
        target: pick(["a", "b", "c", "box"]),
      }),
      width(100 + random(400)),
      parse({ op: "setPage", target: "orders-table", index: random(5) }),
      parse({ op: "remove", target: pick(["box", "pair"]) }),
    ]

    for (let run = 0; run < 150; run++) {
      sessionStorage.clear()
      const { store } = await setup()
      for (let change = random(4); change > 0; change--) {
        store.actions.applyOps(
          "session",
          Array.from({ length: 1 + random(2) }, () => pick(pool()))
        )
      }
      const preview = store.actions.preview(
        answer(Array.from({ length: 1 + random(3) }, () => pick(pool())))
      )
      if (preview.success) {
        lockInKeepsTheView(store)
      }
    }
  })
})
