import { beforeEach, describe, expect, it, vi } from "vitest"

import { opSchema, type Op } from "@pliantui/contract"
import * as core from "@pliantui/core"

import { createLayerStore, type LayerStoreOptions } from "./layer-store"
import { readSession } from "./session-mirror"

// CI runs 500 seeds. Run more locally with, for example:
// LOCK_IN_SEEDS=20000 LOCK_IN_START=1 pnpm --filter @pliantui/react exec vitest run lock-in-view
const seeds = Number(process.env["LOCK_IN_SEEDS"] ?? 500)
const start = Number(process.env["LOCK_IN_START"] ?? 1)

let resolves = 0
vi.mock("@pliantui/core", async (importOriginal) => {
  const actual = await importOriginal<typeof core>()
  return {
    ...actual,
    resolveLayers: (...args: Parameters<typeof actual.resolveLayers>) => {
      resolves++
      return actual.resolveLayers(...args)
    },
  }
})

const surface = "/orders"

function stable(value: unknown): string {
  if (value instanceof Map) {
    return stable(
      [...value].sort(([a], [b]) => (String(a) < String(b) ? -1 : 1))
    )
  }
  if (Array.isArray(value)) {
    return `[${value.map(stable).join(",")}]`
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
      .join(",")}}`
  }
  return value === undefined ? "undefined" : JSON.stringify(value)
}

// Everything a renderer reads from the resolved layers.
function rendered(resolved: core.ResolvedLayers) {
  const properties: Record<string, string> = {}
  for (const [identity, byProperty] of resolved.properties) {
    for (const [property, { winner, breakpoints }] of byProperty) {
      properties[`${identity}|${property}`] = stable([
        winner.check.op,
        [...(breakpoints ?? [])].map(([at, { check }]) => [at, check.op]),
      ])
    }
  }
  const placements: Record<string, string> = {}
  for (const [identity, { container, position }] of resolved.placements) {
    placements[identity] = stable([container, position ?? null])
  }
  return {
    dashboard: stable(
      core.resolveRegion(resolved, {
        id: "dashboard",
        slots: ["a", "b", "c", "d", "orders-table"],
      })
    ),
    sidebar: stable(
      core.resolveRegion(resolved, { id: "sidebar", slots: ["e", "f"] })
    ),
    table: stable(
      core.compileTableState(resolved, {
        table: "orders-table",
        columns: ["x", "y", "z"],
      })
    ),
    properties: stable(properties),
    placements: stable(placements),
    unapplied: stable(
      resolved.unapplied
        .map(({ check, reason }) => stable([check.op, reason]))
        .sort()
    ),
  }
}

function createRandom(seed: number) {
  let state = seed
  function random(max: number) {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    return Math.floor(state / 65_536) % max
  }
  function pick<T>(items: readonly T[]): T {
    const item = items[random(items.length)]
    if (item === undefined) {
      throw new Error("Nothing to pick")
    }
    return item
  }
  return { random, pick }
}

const items = ["a", "b", "c", "d", "e", "f", "g", "h", "box", "pair", "ins1"]
const created = ["box", "pair", "ins1"]
const breakpoints = ["base", "sm", "md", "lg", "xl"]
const columns = ["x", "y", "z"]

function createOps({ random, pick }: ReturnType<typeof createRandom>) {
  const parentOf = (item: string) =>
    ["e", "f"].includes(item) ? "sidebar" : "dashboard"
  const targetOf = (item: string) =>
    created.includes(item) ? item : `${parentOf(item)}/slots/${item}`
  const anyTarget = (item: string) =>
    random(2)
      ? targetOf(item)
      : `${pick(["dashboard", "box", "sidebar"])}/slots/${item}`
  const layout = () =>
    random(2)
      ? { mode: "grid", columns: 1 + random(4) }
      : { mode: pick(["row", "stack"]) }

  function op(): Op | undefined {
    const item = pick(items)
    const anchor = pick(items)
    const candidates: (() => unknown)[] = [
      () => ({
        op: "move",
        target: targetOf(item),
        to: {
          into: pick(["box", "pair", "d", "sidebar", "dashboard", "g", "ins1"]),
        },
      }),
      () => ({
        op: "move",
        target: anyTarget(item),
        to: pick([{ before: anchor }, { after: anchor }, { index: random(5) }]),
      }),
      () => ({
        op: "pin",
        target: anyTarget(item),
        where: pick(["start", "end", "sticky", "none"]),
      }),
      () => ({
        op: "wrap",
        target: pick(["dashboard", "sidebar", "box"]),
        id: pick(["box", "pair"]),
        items: [...new Set([pick(items), pick(items), pick(items)])].filter(
          (wrapped) => wrapped !== "box" && wrapped !== "pair"
        ),
        ...layout(),
      }),
      () => ({
        op: "insert",
        target: pick(["dashboard", "box", "sidebar"]),
        node: {
          id: "ins1",
          kind: "chart",
          dataset: pick(["ds1", "ds2"]),
          ...(random(2) ? { label: "L" } : {}),
        },
        at: pick([{ index: random(4) }, { after: anchor }, { before: anchor }]),
      }),
      () => ({
        op: "remove",
        target: pick([
          "box",
          "pair",
          "ins1",
          "dashboard/slots/a",
          "sidebar/slots/e",
        ]),
      }),
      () => ({
        op: pick(["hide", "show"]),
        target: pick(["a", "b", "e", "box", "ins1", "g"]),
      }),
      () => ({
        op: "collapse",
        target: pick(["dashboard", "box"]),
        items: [...new Set([pick(items), pick(items)])],
        into: pick(["more", "tabs", "accordion"]),
        ...(random(2) ? { label: pick(["M", "N"]) } : {}),
      }),
      () => ({
        op: "setLayout",
        target: pick(["dashboard", "box", "sidebar"]),
        ...layout(),
        ...(random(3) ? { at: pick(breakpoints) } : {}),
      }),
      () => ({
        op: "span",
        target: anyTarget(item),
        columns: 1 + random(4),
        ...(random(3) ? { at: pick(breakpoints) } : {}),
      }),
      () => ({
        op: "setFilter",
        target: "orders-table",
        filter: { field: pick(["x", "y"]), operator: "eq", value: random(3) },
      }),
      () => ({
        op: "clearFilter",
        target: "orders-table",
        field: pick(["x", "y"]),
      }),
      () => ({
        op: "setSort",
        target: "orders-table",
        sort: [{ field: pick(["x", "y"]), dir: pick(["asc", "desc"]) }],
      }),
      () => ({
        op: "setColumnWidth",
        target: `orders-table/columns/${pick(columns)}`,
        width: 100 + random(3) * 50,
      }),
      () => ({
        op: "move",
        target: `orders-table/columns/${pick(columns)}`,
        to: pick([{ before: pick(columns) }, { index: random(3) }]),
      }),
      () => ({ op: "setPage", target: "orders-table", index: random(3) }),
      () => ({
        op: pick(["promote", "demote"]),
        target: anyTarget(item),
      }),
    ]
    const result = opSchema.safeParse(pick(candidates)())
    return result.success ? result.data : undefined
  }

  return (count: number) =>
    Array.from({ length: count }, op).filter(
      (generated): generated is Op => generated !== undefined
    )
}

function answer(id: number, ops: Op[]) {
  return {
    v: 1,
    id: `01KAB00000000000000000${String(id % 10_000).padStart(4, "0")}`,
    surface,
    layer: "session",
    ops,
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "ai",
    createdBy: "user-1",
    createdAt: "2026-11-19T00:00:00.000Z",
  }
}

async function createStore(
  mounted: readonly string[],
  options: Partial<LayerStoreOptions> = {}
) {
  const store = createLayerStore({
    surface,
    storage: { load: () => ({}), save: () => undefined },
    ...options,
  })
  store.connect()
  store.registerNodes(mounted)
  await Promise.resolve()
  return store
}

beforeEach(() => {
  sessionStorage.clear()
})

describe("lockIn", () => {
  it("never changes what renders", async () => {
    const changed: string[] = []
    let lockedIn = 0
    for (let seed = start; seed < start + seeds; seed++) {
      sessionStorage.clear()
      const random = createRandom(seed)
      const ops = createOps(random)
      const store = await createStore([
        "dashboard",
        "sidebar",
        "a",
        "b",
        "c",
        "d",
        "e",
        "f",
        "orders-table",
        ...(random.random(2) ? ["g"] : []),
      ])
      for (let change = random.random(3); change > 0; change--) {
        store.actions.applyOps("personal", ops(1 + random.random(3)))
      }
      for (let change = random.random(5); change > 0; change--) {
        store.actions.applyOps("session", ops(1 + random.random(4)))
      }
      const previewed = ops(1 + random.random(6))
      const unapplied = store.getResolved().unapplied[0]
      if (random.random(4) === 0 && unapplied) {
        previewed.push(unapplied.check.op)
      }
      if (
        previewed.length === 0 ||
        !store.actions.preview(answer(seed, previewed)).success
      ) {
        continue
      }
      const before = rendered(store.getResolved())
      const result = store.actions.lockIn()
      expect(result.success).toBe(true)
      if (result.success && result.overlay) {
        lockedIn++
      }
      const after = rendered(store.getResolved())
      for (const key of Object.keys(before) as (keyof typeof before)[]) {
        if (before[key] !== after[key]) {
          changed.push(`seed ${String(seed)}: ${key}`)
        }
      }
    }

    expect(changed).toEqual([])
    expect(lockedIn).toBeGreaterThan(seeds / 2)
  }, 600_000)

  it("keeps changes made during a preview, rendering as before", async () => {
    const changed: string[] = []
    let moved = 0
    let failed = 0
    const mounted = [
      "dashboard",
      "sidebar",
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "orders-table",
    ]
    for (let seed = start; seed < start + seeds; seed++) {
      const random = createRandom(seed)
      const ops = createOps(random)
      const batches = (count: number) =>
        Array.from({ length: count }, () => ops(1 + random.random(3))).filter(
          (changes) => changes.length > 0
        )
      const personalChanges = batches(random.random(3))
      const sessionChanges = batches(random.random(4))
      // One or two previews, each with clicks made while it showed, and a
      // reload of the tab before it ends, now and then.
      const previews = Array.from({ length: 1 + random.random(2) }, () => ({
        ops: ops(1 + random.random(5)),
        clicks: batches(1 + random.random(3)),
      }))
      const reload = random.random(3) === 0
      const end = random.pick(["lockIn", "discard"] as const)
      const run = async () => {
        sessionStorage.clear()
        const saved: unknown[] = []
        const storage = {
          load: () => ({ personal: [...saved] }),
          save: (_surface: string, overlay: unknown) => {
            saved.push(overlay)
          },
        }
        let store = await createStore(mounted, { storage })
        for (const changes of personalChanges) {
          store.actions.applyOps("personal", changes)
        }
        for (const changes of sessionChanges) {
          store.actions.applyOps("session", changes)
        }
        let shown = false
        for (const [index, { ops: previewed, clicks }] of previews.entries()) {
          if (previewed.length > 0) {
            shown =
              store.actions.preview(answer(seed * 3 + index, previewed))
                .success || shown
          }
          for (const changes of clicks) {
            store.actions.applyOps("session", changes)
          }
        }
        if (reload) {
          store.flush()
          store = await createStore(mounted, { storage })
        }
        return { store, shown: shown && store.getPreview() !== null, saved }
      }
      const { store, shown, saved } = await run()
      if (!shown) {
        continue
      }
      store.flush()
      const before = rendered(store.getResolved())
      // Discarding shows what showed, less the preview.
      const expected =
        end === "lockIn"
          ? before
          : rendered(
              core.resolveLayers(
                [...saved, ...readSession(surface).overlays].flatMap(
                  (input) => core.loadOverlay(input).data ?? []
                ),
                { surface, baseIds: { ids: mounted, source: "mounted" } }
              )
            )
      const savedBefore = saved.length
      if (end === "lockIn") {
        // A preview whose changes can't keep showing once it's locked in
        // (a removal that applied only in its layer, say) stays.
        if (!store.actions.lockIn().success) {
          failed++
          expect(rendered(store.getResolved())).toEqual(before)
          continue
        }
      } else {
        store.actions.discard()
      }
      store.flush()
      if (
        saved
          .slice(savedBefore)
          .some(
            (overlay) =>
              typeof overlay === "object" &&
              overlay !== null &&
              "source" in overlay &&
              overlay.source === "manual"
          )
      ) {
        moved++
      }
      const after = rendered(store.getResolved())
      for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
        if (expected[key] !== after[key]) {
          changed.push(`seed ${String(seed)} (${end}): ${key}`)
        }
      }
    }

    expect(changed).toEqual([])
    expect(moved).toBeGreaterThan(seeds / 4)
    expect(failed).toBeLessThan(seeds / 100)
  }, 600_000)

  it("coalesces changes without changing what renders", async () => {
    const changed: string[] = []
    const mounted = [
      "dashboard",
      "sidebar",
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "orders-table",
    ]
    for (let seed = start; seed < start + seeds; seed++) {
      sessionStorage.clear()
      const random = createRandom(seed)
      const ops = createOps(random)
      const steps = Array.from({ length: 1 + random.random(8) }, () => ({
        layer: random.pick(["personal", "session"] as const),
        ops: ops(1 + random.random(2)),
        after: random.random(600),
      }))
      const run = async (coalesce: boolean) => {
        sessionStorage.clear()
        let time = Date.UTC(2026, 10, 19)
        const store = await createStore(mounted, { coalesce, now: () => time })
        for (const { layer, ops: changes, after } of steps) {
          time += after
          if (changes.length > 0) {
            store.actions.applyOps(layer, changes)
          }
        }
        const result = rendered(store.getResolved())
        store.flush()
        return result
      }
      const coalesced = await run(true)
      const separate = await run(false)
      for (const key of Object.keys(coalesced) as (keyof typeof coalesced)[]) {
        if (coalesced[key] !== separate[key]) {
          changed.push(`seed ${String(seed)}: ${key}`)
        }
      }
    }

    expect(changed).toEqual([])
  }, 600_000)

  it("moves a chain of ops sharing properties in one round", async () => {
    const count = 500
    const ids = Array.from({ length: count }, (_, k) => [
      `p${String(k)}`,
      `q${String(k)}`,
    ]).flat()
    const store = await createStore(["dashboard", ...ids])
    const collapse = (first: string, second: string, into: string) =>
      opSchema.parse({
        op: "collapse",
        target: "dashboard",
        items: [first, second],
        into,
      })
    store.actions.applyOps("session", [collapse("p0", "q0", "tabs")])
    const chain = Array.from({ length: count }, (_, k) =>
      collapse(`p${String(k)}`, `p${String(k + 1)}`, "more")
    )
    expect(store.actions.preview(answer(1, chain)).success).toBe(true)

    resolves = 0
    const result = store.actions.lockIn()
    expect(result).toMatchObject({ success: true, overlay: null })
    expect(result.success && result.keptInSession).toHaveLength(count)
    expect(resolves).toBeLessThanOrEqual(2)
  })
})
