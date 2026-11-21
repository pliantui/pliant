import { describe, expect, it } from "vitest"

import type { Flags, Layer, Op } from "@pliantui/contract"

import {
  loadOverlay,
  resolveLayers,
  resolveRegion,
  validateOverlay,
  type LoadedOverlay,
  type OpPropertyKey,
  type RegionEntry,
  type ResolvedLayers,
  type SkippedOp,
} from "./index"

// Random surfaces and overlays, checked against what the guardrails promise.
// The checker below reads only the resolved result, the way a renderer
// would, and knows the page only as the options describe it.

const surface = "/orders"

// The page every run starts from: two regions, two node action groups, an
// item action group, a form and a notice.
const tree: Readonly<Record<string, string | null>> = {
  page: null,
  main: "page",
  side: "page",
  actions: "main",
  save: "actions",
  cancel: "actions",
  export: "actions",
  archive: "actions",
  delete: "actions",
  form: "main",
  toolbar: "main",
  bar: "side",
  ok: "bar",
  help: "bar",
  drop: "bar",
  notice: "side",
}

// Each action group's members in render order.
const groups: Readonly<Record<string, readonly string[]>> = {
  page: ["main", "side"],
  main: ["actions", "form", "toolbar"],
  side: ["bar", "notice"],
  actions: ["save", "cancel", "export", "archive", "delete"],
  bar: ["ok", "help", "drop"],
  "toolbar/actions": ["run", "copy", "print", "purge"],
}

const fields = ["email", "name"]
const tools = groups["toolbar/actions"] ?? []

// Nodes ops create, and the node ops address them in.
const created: Readonly<Record<string, string>> = {
  w: "actions",
  v: "bar",
  x: "side",
}

const layers: readonly Layer[] = ["org", "team", "personal", "session"]
const teams = ["sales", "ops", "eng"]
const times = [
  "2026-11-01T09:30:00.000Z",
  "2026-11-02T09:30:00.000Z",
  "2026-11-03T09:30:00.000Z",
]

type Random = () => number

// A fixed seed keeps the runs the same on every machine.
function random(seed: number): Random {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let next = Math.imul(state ^ (state >>> 15), 1 | state)
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(list: readonly T[], next: Random): T {
  const value = list[Math.floor(next() * list.length)]
  if (value === undefined) {
    throw new Error("Nothing to pick")
  }
  return value
}

function shuffled<T>(list: readonly T[], next: Random): T[] {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(next() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap] as T, copy[index] as T]
  }
  return copy
}

const reshuffle = <T>(record: Readonly<Record<string, T>>, next: Random) =>
  Object.fromEntries(shuffled(Object.entries(record), next))

const homeOf = (id: string) => tree[id] ?? created[id]

/** The one-segment address ops use: `actions/slots/save`. */
function slot(id: string) {
  const home = homeOf(id)
  return home ? `${home}/slots/${id}` : id
}

/** The full address flags use: `page/slots/main/slots/actions/slots/save`. */
function addressOf(id: string): string {
  const [node = id, collection, item] = id.split("/")
  if (collection !== undefined && item !== undefined) {
    return `${addressOf(node)}/${collection}/${item}`
  }
  const home = homeOf(id)
  return home ? `${addressOf(home)}/slots/${id}` : id
}

/** Each node or item on the way to an address, with the node that holds it. */
function addressParents(address: string): [string, string][] {
  const segments = address.split("/")
  const pairs: [string, string][] = []
  let parent = segments[0] ?? address
  for (let index = 1; index + 1 < segments.length; index += 2) {
    const collection = segments[index] ?? ""
    const id = segments[index + 1] ?? ""
    const child = collection === "slots" ? id : `${parent}/${collection}/${id}`
    pairs.push([child, parent])
    parent = child
  }
  return pairs
}

const identityOf = (address: string) =>
  addressParents(address).at(-1)?.[0] ?? address

const last = (id: string) => id.slice(id.lastIndexOf("/") + 1)

// The page as one run describes it.
interface Surface {
  readonly flags: Record<string, Flags>
  readonly baseParents?: Record<string, string | null>
  readonly baseOrder?: Record<string, readonly string[]>
  readonly teamOrder?: readonly string[]
}

function randomSurface(next: Random): Surface {
  const flags: Record<string, Flags> = {}
  const flag = (id: string, name: keyof Flags) => {
    const address = addressOf(id)
    flags[address] = { ...flags[address], [name]: true }
  }
  const protectable = [
    "save",
    "export",
    "ok",
    "notice",
    "actions",
    "x",
    "form/fields/email",
    "toolbar/actions/copy",
    "toolbar/actions/run",
  ]
  for (const id of protectable) {
    if (next() < 0.4) {
      flag(id, next() < 0.5 ? "critical" : "required")
    }
  }
  for (const group of ["actions", "bar", "toolbar/actions"]) {
    const members = shuffled(groups[group] ?? [], next).map((id) =>
      group.includes("/") ? `${group}/${id}` : id
    )
    if (next() < 0.85) {
      flag(members[0] ?? "", "primary")
    }
    for (const id of members.slice(1)) {
      if (next() < 0.4) {
        flag(id, "destructive")
      }
    }
  }

  const treeKind = next()
  const baseParents =
    treeKind < 0.35
      ? undefined
      : Object.fromEntries(
          Object.entries(tree).filter(() => treeKind < 0.7 || next() < 0.7)
        )
  const orderKind = next()
  const named = (id: string) => !baseParents || id in baseParents
  const baseOrder =
    orderKind < 0.3
      ? undefined
      : Object.fromEntries(
          Object.entries(groups).flatMap(([group, members]) => {
            const node = group.split("/")[0] ?? group
            const partial = orderKind >= 0.65
            if (!named(node) || (partial && next() < 0.3)) {
              return []
            }
            return [
              [
                group,
                members.filter(
                  (id) =>
                    (group.includes("/") || named(id)) &&
                    (!partial || next() < 0.75)
                ),
              ],
            ]
          })
        )
  const teamOrder = next() < 0.5 ? undefined : shuffled(teams, next).slice(0, 2)
  return {
    flags,
    ...(baseParents && { baseParents }),
    ...(baseOrder && { baseOrder }),
    ...(teamOrder && { teamOrder }),
  }
}

function randomOp(next: Random): unknown {
  const nodes = Object.keys(tree).filter((id) => id !== "page")
  const movable = [...nodes, "w", "x"]
  const id = pick(movable, next)
  const siblings = [...nodes, "w", "v", "x"].filter((each) => each !== id)
  const item = pick(tools, next)
  const tool = `toolbar/actions/${item}`
  const otherItem = pick(
    tools.filter((each) => each !== item),
    next
  )
  const container = pick(
    ["page", "main", "side", "actions", "bar", "form", "toolbar", "w"],
    next
  )
  const childrenOf = (node: string) =>
    node === "toolbar"
      ? tools
      : node === "form"
        ? fields
        : node === "w"
          ? (groups["actions"] ?? [])
          : (groups[node] ?? [])
  const into = pick(
    ["main", "side", "actions", "bar", "notice", "save", "w", "v", "x"].filter(
      (each) => each !== id
    ),
    next
  )
  const wrapIn = pick(["actions", "bar", "side"], next)
  const wrapped = (groups[wrapIn] ?? []).filter(() => next() < 0.5)
  const at = pick<unknown>(
    [
      { before: pick(siblings, next) },
      { after: pick(siblings, next) },
      { index: Math.floor(next() * 5) },
    ],
    next
  )
  return pick<() => unknown>(
    [
      () => ({
        op: pick(["hide", "hide", "show"], next),
        target: pick(
          [slot(id), slot("v"), tool, `form/fields/${pick(fields, next)}`],
          next
        ),
      }),
      () => ({
        op: "collapse",
        target: slot(container),
        items: [pick(childrenOf(container), next)],
        into: pick(["more", "accordion", "none"], next),
      }),
      () => ({ op: "move", target: slot(id), to: at }),
      () => ({ op: "move", target: slot(id), to: { into: slot(into) } }),
      () => ({
        op: "pin",
        target: slot(id),
        where: pick(["start", "end", "sticky", "none"], next),
      }),
      () => ({
        op: "move",
        target: tool,
        to: pick(
          [
            { before: otherItem },
            { after: otherItem },
            { index: Math.floor(next() * 4) },
          ],
          next
        ),
      }),
      () => ({
        op: "pin",
        target: tool,
        where: pick(["start", "end", "none"], next),
      }),
      () => ({ op: pick(["promote", "demote"], next), target: tool }),
      () => ({
        op: "wrap",
        target: slot(wrapIn),
        id: pick(["w", "v"], next),
        items:
          wrapped.length > 1 ? wrapped : (groups[wrapIn] ?? []).slice(0, 2),
        mode: "row",
      }),
      () => ({
        op: "insert",
        target: slot(pick(["actions", "bar", "side", "w"], next)),
        node: { id: "x", kind: "stat", dataset: "orders" },
        at,
      }),
      () => ({ op: "remove", target: pick(["w", "v", "x"], next) }),
    ],
    next
  )()
}

let count = 0

function stored(layer: Layer, ops: unknown[], next: Random) {
  count++
  return {
    v: 1,
    id: `01JBQ3V8Z7XKQ2M4N5P6${String(count).padStart(6, "0")}`,
    surface,
    layer,
    ...(layer === "org" && { scope: { org: "acme" } }),
    ...(layer === "team" && { scope: { team: pick(teams, next) } }),
    ops,
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "manual",
    createdBy: "user_123",
    createdAt: pick(times, next),
  }
}

type Stored = ReturnType<typeof stored>

function load(input: Stored): LoadedOverlay {
  const result = loadOverlay(input)
  if (!result.success) {
    throw result.error
  }
  return result.data
}

function randomStack(next: Random): Stored[] {
  return layers.flatMap((layer) =>
    Array.from({ length: Math.floor(next() * 3) }, () =>
      stored(
        layer,
        Array.from({ length: 1 + Math.floor(next() * 5) }, () =>
          randomOp(next)
        ),
        next
      )
    )
  )
}

// What the options and the ops tell about which node holds which, as
// `ResolveLayersOptions` documents it: `known` from the options alone,
// `parents` adding what the ops' addresses show.
interface Model {
  readonly flags: ReadonlyMap<string, Flags>
  readonly known: ReadonlyMap<string, string>
  readonly parents: ReadonlyMap<string, string>
  readonly baseOrder: Readonly<Record<string, readonly string[]>>
}

function modelOf(page: Surface, ops: readonly Op[]): Model {
  const flags = new Map<string, Flags>()
  const known = new Map<string, string>()
  for (const [id, parent] of Object.entries(page.baseParents ?? {})) {
    if (parent !== null) {
      known.set(id, parent)
    }
  }
  for (const [address, flag] of Object.entries(page.flags)) {
    const id = identityOf(address)
    flags.set(id, { ...flags.get(id), ...flag })
    for (const [child, parent] of addressParents(address)) {
      known.set(child, parent)
    }
  }
  for (const [group, members] of Object.entries(page.baseOrder ?? {})) {
    for (const id of group.includes("/") ? [] : members) {
      if (!known.has(id)) {
        known.set(id, group)
      }
    }
  }
  const parents = new Map(known)
  for (const op of ops) {
    const addresses = [
      op.target,
      ...(op.op === "move" && "into" in op.to ? [op.to.into] : []),
    ]
    for (const [child, parent] of addresses.flatMap(addressParents)) {
      if (!parents.has(child) && (!page.baseParents || child.includes("/"))) {
        parents.set(child, parent)
      }
    }
  }
  return { flags, known, parents, baseOrder: page.baseOrder ?? {} }
}

const opOf = (layers: ResolvedLayers, id: string, key: OpPropertyKey) =>
  layers.properties.get(id)?.get(key)?.winner.check.op

/** The node an insert or wrap created `id` in, while it is live. */
function createdIn(layers: ResolvedLayers, id: string) {
  const op = opOf(layers, id, "inserted")
  return op && op.op !== "remove" ? identityOf(op.target) : undefined
}

const containerOf = (layers: ResolvedLayers, model: Model, id: string) =>
  layers.placements.get(id)?.container ??
  createdIn(layers, id) ??
  model.parents.get(id)

const isWrapper = (layers: ResolvedLayers, id: string) =>
  opOf(layers, id, "inserted")?.op === "wrap"

function collapsedIn(layers: ResolvedLayers, id: string, container: string) {
  const op = opOf(layers, container, `collapse.${last(id)}`)
  return op?.op === "collapse" && op.into !== "none"
}

function demoted(layers: ResolvedLayers, id: string) {
  const position = layers.placements.get(id)?.position
  return position !== undefined && "promoted" in position && !position.promoted
}

/** The flagged nodes out of sight: hidden, removed, demoted, collapsed or in a cycle. */
function outOfSight(layers: ResolvedLayers, model: Model): string[] {
  return [...model.flags]
    .filter(([, flags]) => flags.critical === true || flags.required === true)
    .map(([node]) => node)
    .filter((node) => {
      const seen = new Set<string>()
      for (let id: string | undefined = node; id !== undefined;) {
        if (seen.has(id)) {
          return true
        }
        seen.add(id)
        const container = containerOf(layers, model, id)
        if (
          opOf(layers, id, "visible")?.op === "hide" ||
          opOf(layers, id, "inserted")?.op === "remove" ||
          demoted(layers, id) ||
          (container !== undefined && collapsedIn(layers, id, container))
        ) {
          return true
        }
        id = container
      }
      return false
    })
}

/**
 * A group's members before any op: those `baseOrder` lists, in order, and
 * the others the options put there, an unlisted primary action first, an
 * unlisted destructive one last, the rest by id.
 */
function startOrder(group: string, model: Model): string[] {
  const prefix = group.includes("/") ? `${group}/` : ""
  const listed = (model.baseOrder[group] ?? []).map((id) => prefix + id)
  const side = (id: string) =>
    model.flags.get(id)?.primary ? -1 : model.flags.get(id)?.destructive ? 1 : 0
  const others = [...new Set([...model.flags.keys(), ...model.known.keys()])]
    .filter(
      (id) =>
        !listed.includes(id) &&
        (prefix ? id.startsWith(prefix) : model.known.get(id) === group)
    )
    .sort((a, b) => side(a) - side(b) || (a < b ? -1 : a > b ? 1 : 0))
  return [
    ...others.filter((id) => side(id) < 0),
    ...listed,
    ...others.filter((id) => side(id) >= 0),
  ]
}

interface Placed {
  readonly id: string
  readonly shown: boolean
  readonly overflow: boolean
}

// What a region renders, with each wrapper's nodes in its place.
function flattened(
  entries: readonly RegionEntry[],
  shown = true,
  overflow = false
): Placed[] {
  return entries.flatMap((entry) => {
    const placed = {
      id: entry.id,
      shown: shown && entry.visible,
      overflow: overflow || entry.collapsed !== undefined,
    }
    return entry.kind === "wrapper"
      ? flattened(entry.entries, placed.shown, placed.overflow)
      : [placed]
  })
}

/**
 * An item group in render order: its item ops replayed on a region of
 * slots, which orders the same way. A promote or demote keeps the item in
 * place, like `pin none`, and a demote sends it to the overflow.
 */
function itemOrder(layers: ResolvedLayers, group: string, model: Model) {
  const node = group.slice(0, group.indexOf("/"))
  const members = startOrder(group, model)
  const skipped = new Set(layers.skipped.map(({ check }) => check))
  const mirrored = layers.overlays.map((loaded) => ({
    ...stored("personal", [], () => 0),
    ops: loaded.ops.flatMap((check): unknown[] => {
      if (skipped.has(check) || check.status !== "valid") {
        return []
      }
      const op = check.op
      if (op.op === "collapse" && identityOf(op.target) === node) {
        return [{ ...op, target: "mirror" }]
      }
      if (!members.includes(op.target)) {
        return []
      }
      const target = `mirror/slots/${last(op.target)}`
      return op.op === "promote" || op.op === "demote"
        ? [{ op: "pin", target, where: "none" }]
        : [{ ...op, target }]
    }),
  }))
  const mirror = resolveLayers(
    mirrored.filter(({ ops }) => ops.length > 0).map(load),
    { surface }
  )
  return flattened(
    resolveRegion(mirror, { id: "mirror", slots: members.map(last) }).entries
  ).map((entry) => {
    const id = `${group}/${entry.id}`
    return { ...entry, id, overflow: entry.overflow || demoted(layers, id) }
  })
}

/** The group that holds `id` now: an item's collection, or a node's container past wrappers. */
function groupNow(layers: ResolvedLayers, model: Model, id: string) {
  if (id.includes("/")) {
    return id.slice(0, id.lastIndexOf("/"))
  }
  const seen = new Set<string>()
  let group = containerOf(layers, model, id)
  while (group !== undefined && isWrapper(layers, group) && !seen.has(group)) {
    seen.add(group)
    group = containerOf(layers, model, group)
  }
  return group
}

/** 2 when `destructive` comes before `primary`, 1 right after it, else 0. */
function closeness(
  order: readonly string[],
  destructive: string,
  primary: string
) {
  const at = order.indexOf(destructive)
  const its = order.indexOf(primary)
  return at < 0 || its < 0 ? 0 : at < its ? 2 : at === its + 1 ? 1 : 0
}

/** The destructive actions closer to their group's primary action than the base puts them. */
function tooClose(layers: ResolvedLayers, model: Model): string[] {
  const flagged = (name: "primary" | "destructive") =>
    [...model.flags].filter(([, flags]) => flags[name]).map(([id]) => id)
  return flagged("primary").flatMap((primary) => {
    const group = groupNow(layers, model, primary)
    if (group === undefined) {
      return []
    }
    const placed = group.includes("/")
      ? itemOrder(layers, group, model)
      : flattened(
          resolveRegion(layers, { id: group, slots: startOrder(group, model) })
            .entries
        )
    const base = primary.includes("/")
      ? primary.slice(0, primary.lastIndexOf("/"))
      : model.known.get(primary)
    const before = base === undefined ? [] : startOrder(base, model)
    const entryOf = (id: string) => placed.find((entry) => entry.id === id)
    const its = entryOf(primary)
    return flagged("destructive").filter((action) => {
      const own = entryOf(action)
      if (
        !its ||
        !own ||
        action === primary ||
        groupNow(layers, model, action) !== group ||
        (own.overflow && !its.overflow)
      ) {
        return false
      }
      const now =
        its.overflow && !own.overflow
          ? 2
          : closeness(
              placed
                .filter(
                  (entry) =>
                    entry.overflow === own.overflow &&
                    (entry.shown || entry === own || entry === its)
                )
                .map(({ id }) => id),
              action,
              primary
            )
      return now > closeness(before, action, primary)
    })
  })
}

function violations(layers: ResolvedLayers, model: Model) {
  return {
    "stays-visible": outOfSight(layers, model),
    "stays-clear": tooClose(layers, model),
  }
}

const guardrailSkips = (layers: ResolvedLayers) =>
  layers.skipped.flatMap((entry) =>
    entry.reason === "guardrail" ? [entry] : []
  )

const keyOf = (entry: SkippedOp) =>
  [
    entry.overlay.id,
    entry.check.index,
    entry.reason,
    ...(entry.reason === "guardrail" ? [entry.guardrail, entry.node] : []),
  ].join(" ")

interface Run {
  readonly page: Surface
  readonly inputs: readonly Stored[]
  readonly overlays: readonly LoadedOverlay[]
  readonly result: ResolvedLayers
  readonly model: Model
}

function randomRun(next: Random): Run {
  const page = randomSurface(next)
  const inputs = randomStack(next)
  const overlays = inputs.map(load)
  const result = resolveLayers(overlays, { surface, ...page })
  const ops = overlays.flatMap(({ ops: checks }) =>
    checks.flatMap((check) => (check.status === "valid" ? [check.op] : []))
  )
  return { page, inputs, overlays, result, model: modelOf(page, ops) }
}

/** Resolves, with no guardrails, the ops `keep` picks, in resolution order. */
function replay(
  run: Run,
  keep: (overlay: LoadedOverlay, index: number) => boolean
) {
  const byId = new Map(run.inputs.map((input) => [input.id, input]))
  const overlays = run.result.overlays.flatMap((overlay) => {
    const input = byId.get(overlay.id)
    const ops = input?.ops.filter((_, index) => keep(overlay, index)) ?? []
    return input && ops.length > 0 ? [load({ ...input, ops })] : []
  })
  return resolveLayers(overlays, { surface, teamOrder: run.page.teamOrder })
}

describe("guardrails on random surfaces", () => {
  const runs = 250

  it("leaves every resolved result within every guardrail", () => {
    const next = random(20261121)
    const kinds = { "stays-visible": 0, "stays-clear": 0 }
    for (let run = 0; run < runs; run++) {
      const { result, model } = randomRun(next)
      expect(
        result.skipped.filter(({ reason }) => reason !== "guardrail")
      ).toEqual([])
      expect(violations(result, model)).toEqual({
        "stays-visible": [],
        "stays-clear": [],
      })
      for (const { guardrail } of guardrailSkips(result)) {
        kinds[guardrail]++
      }
    }
    // Both rules must have had something to stop.
    expect(kinds["stays-visible"]).toBeGreaterThan(runs / 3)
    expect(kinds["stays-clear"]).toBeGreaterThan(runs / 3)
  })

  it("resolves the same, and skips the same ops, in any input order", () => {
    const next = random(1121)
    for (let run = 0; run < runs; run++) {
      const { page, overlays, result } = randomRun(next)
      const reordered = resolveLayers(shuffled(overlays, next), {
        surface,
        flags: reshuffle(page.flags, next),
        baseParents: page.baseParents && reshuffle(page.baseParents, next),
        baseOrder: page.baseOrder && reshuffle(page.baseOrder, next),
        teamOrder: page.teamOrder,
      })
      expect(reordered.skipped.map(keyOf)).toEqual(result.skipped.map(keyOf))
      expect(reordered.placements).toEqual(result.placements)
      expect(reordered.properties).toEqual(result.properties)
    }
  })

  it("skips only ops that break their guardrail, given the ops kept before them", () => {
    const next = random(2111)
    for (let run = 0; run < runs; run++) {
      const current = randomRun(next)
      const { result, model } = current
      const skips = guardrailSkips(result)
      const order = result.overlays.flatMap((overlay) =>
        overlay.ops.map((check) => ({ overlay, index: check.index }))
      )
      for (const skip of skips) {
        const at = order.findIndex(
          ({ overlay, index }) =>
            overlay === skip.overlay && index === skip.check.index
        )
        const before = new Set(
          order
            .slice(0, at)
            .filter(
              ({ overlay, index }) =>
                !skips.some(
                  (other) =>
                    other.overlay === overlay && other.check.index === index
                )
            )
            .map(({ overlay, index }) => `${overlay.id} ${String(index)}`)
        )
        const kept = (overlay: LoadedOverlay, index: number) =>
          before.has(`${overlay.id} ${String(index)}`)
        expect(violations(replay(current, kept), model)).toEqual({
          "stays-visible": [],
          "stays-clear": [],
        })
        const added = replay(
          current,
          (overlay, index) =>
            kept(overlay, index) ||
            (overlay.id === skip.overlay.id && index === skip.check.index)
        )
        expect(violations(added, model)[skip.guardrail]).toContain(skip.node)
      }

      // validateOverlay rejects exactly the top overlay's skipped ops.
      const top = result.overlays.at(-1)
      const input = current.inputs.find(({ id }) => id === top?.id)
      if (top && input) {
        const validated = validateOverlay(input, {
          layers: {
            overlays: current.inputs.filter((other) => other !== input),
            surface,
            ...current.page,
          },
        })
        const rejected = validated.success
          ? []
          : validated.error.issues
              .filter(({ message }) => message.startsWith("The item "))
              .map(({ path }) => path[1])
        expect(rejected).toEqual(
          skips
            .filter(({ overlay }) => overlay === top)
            .map(({ check }) => check.index)
        )
      }
    }
  })
})
