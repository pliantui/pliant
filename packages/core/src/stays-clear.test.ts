import { describe, expect, it } from "vitest"

import type { Flags, Layer } from "@pliantui/contract"

import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import {
  resolveLayers,
  type ResolvedLayers,
  type ResolveLayersOptions,
} from "./resolve-layers"
import { resolveRegion, type RegionEntry } from "./resolve-region"
import { validateOverlay } from "./validate-overlay"

const surface = "/checkout"

const scopes = {
  org: { org: "acme" },
  team: { team: "sales" },
} as const

function stored(layer: Layer, ops: unknown[], id: string) {
  return {
    v: 1,
    id,
    surface,
    layer,
    ...((layer === "org" || layer === "team") && { scope: scopes[layer] }),
    ops,
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "manual",
    createdBy: "user_123",
    createdAt: "2026-11-01T09:30:00.000Z",
  }
}

let count = 0

function overlay(layer: Layer, ops: unknown[]): LoadedOverlay {
  count++
  const result = loadOverlay(
    stored(layer, ops, `01JBQ3V8Z7XKQ2M4N5P6${String(count).padStart(6, "0")}`)
  )
  if (!result.success) {
    throw result.error
  }
  return result.data
}

const flags: Record<string, Flags> = {
  "page/slots/actions/slots/save": { primary: true },
  "page/slots/actions/slots/delete": { destructive: true },
}

const baseParents = {
  page: null,
  actions: "page",
  save: "actions",
  cancel: "actions",
  archive: "actions",
  delete: "actions",
  side: "page",
}

const baseOrder = { actions: ["save", "cancel", "archive", "delete"] }

function resolve(
  overlays: LoadedOverlay[],
  options: Partial<ResolveLayersOptions> = {}
): ResolvedLayers {
  return resolveLayers(overlays, {
    surface,
    flags,
    baseParents,
    baseOrder,
    ...options,
  })
}

function guarded({ skipped }: ResolvedLayers) {
  return skipped.flatMap((entry) =>
    entry.reason === "guardrail"
      ? [
          {
            layer: entry.overlay.layer,
            op: entry.check.op,
            guardrail: entry.guardrail,
            flag: entry.flag,
            node: entry.node,
            conflictsWith: entry.conflictsWith.map(({ check }) => check.op),
          },
        ]
      : []
  )
}

const slot = (id: string) => `actions/slots/${id}`
const move = (id: string, to: unknown) => ({ op: "move", target: slot(id), to })
const pin = (id: string, where: string) => ({
  op: "pin",
  target: slot(id),
  where,
})
const collapse = (items: string[], into = "more") => ({
  op: "collapse",
  target: "actions",
  items,
  into,
})

function order(result: ResolvedLayers) {
  return resolveRegion(result, {
    id: "actions",
    slots: ["save", "cancel", "archive", "delete"],
  }).entries.map(({ id }) => id)
}

describe("destructive actions", () => {
  it.each([
    ["moved right after the primary action", move("delete", { after: "save" })],
    ["moved before the primary action", move("delete", { before: "save" })],
    ["moved to the first index", move("delete", { index: 0 })],
    ["pinned to the start", pin("delete", "start")],
  ])("skips a destructive action %s", (_, op) => {
    const result = resolve([overlay("personal", [op])])
    expect(guarded(result)).toEqual([
      {
        layer: "personal",
        op,
        guardrail: "stays-clear",
        flag: "destructive",
        node: "delete",
        conflictsWith: [],
      },
    ])
    expect(order(result)).toEqual(["save", "cancel", "archive", "delete"])
  })

  it.each([
    ["moved right before it", move("save", { before: "delete" })],
    ["pinned to the end", pin("save", "end")],
    ["collapsed into the overflow", collapse(["save"])],
  ])("skips the primary action %s", (_, op) => {
    const result = resolve([overlay("personal", [op])])
    expect(guarded(result)).toMatchObject([{ op, node: "delete" }])
  })

  it.each([
    [
      "moved away from the primary action",
      move("delete", { after: "archive" }),
    ],
    ["moved one place closer", move("delete", { before: "archive" })],
    ["pinned to the end", pin("delete", "end")],
    ["collapsed into the overflow", collapse(["delete"])],
    ["moved into another node", move("delete", { into: "side" })],
  ])("applies a destructive action %s", (_, op) => {
    const result = resolve([overlay("personal", [op])])
    expect(guarded(result)).toEqual([])
    expect(result.placements.get("delete")?.winner?.check.op ?? op).toEqual(op)
  })

  it("applies the same ops when no action is primary", () => {
    const op = pin("delete", "start")
    const result = resolve([overlay("personal", [op])], {
      flags: { "page/slots/actions/slots/delete": { destructive: true } },
    })
    expect(guarded(result)).toEqual([])
    expect(order(result)[0]).toBe("delete")
  })

  it("skips the op from the highest layer when layers combine", () => {
    const team = move("delete", { before: "archive" })
    const personal = move("cancel", { after: "archive" })
    const result = resolve([
      overlay("personal", [personal]),
      overlay("team", [team]),
    ])
    expect(guarded(result)).toEqual([
      {
        layer: "personal",
        op: personal,
        guardrail: "stays-clear",
        flag: "destructive",
        node: "delete",
        conflictsWith: [team],
      },
    ])
    expect(order(result)).toEqual(["save", "cancel", "delete", "archive"])
  })

  it("skips a hide that leaves no shown action between them", () => {
    const hideCancel = { op: "hide", target: slot("cancel") }
    const hideArchive = { op: "hide", target: slot("archive") }
    const result = resolve([overlay("personal", [hideCancel, hideArchive])])
    expect(guarded(result)).toMatchObject([{ op: hideArchive }])
  })

  it("orders the overflow like the bar", () => {
    const team = collapse(["delete"])
    const personal = collapse(["save"])
    const result = resolve([
      overlay("team", [team]),
      overlay("personal", [personal]),
    ])
    expect(guarded(result)).toMatchObject([
      { layer: "personal", op: personal, conflictsWith: [team] },
    ])
  })

  it("judges a destructive action moved in from another node", () => {
    const team = move("delete", { into: "actions" })
    const personal = move("delete", { after: "save" })
    const result = resolve(
      [overlay("team", [team]), overlay("personal", [personal])],
      {
        baseParents: { ...baseParents, delete: "side" },
        baseOrder: { actions: ["save", "cancel", "archive"] },
        flags: {
          "page/slots/actions/slots/save": { primary: true },
          "page/slots/side/slots/delete": { destructive: true },
        },
      }
    )
    expect(guarded(result)).toMatchObject([
      { layer: "personal", op: personal, conflictsWith: [team] },
    ])
    expect(order(result)).toEqual(["save", "cancel", "archive", "delete"])
  })

  it("keeps the developer's order, and judges only what gets closer", () => {
    const adjacent = {
      page: null,
      actions: "page",
      save: "actions",
      delete: "actions",
    }
    const next = move("delete", { after: "save" })
    const above = pin("delete", "start")
    const result = resolve([overlay("personal", [next, above])], {
      baseParents: adjacent,
      baseOrder: { actions: ["save", "delete"] },
    })
    expect(guarded(result).map(({ op }) => op)).toEqual([above])
  })

  it("puts an unlisted primary action first and a destructive one last", () => {
    const result = resolve(
      [
        overlay("personal", [
          move("delete", { after: "save" }),
          move("delete", { before: "save" }),
        ]),
      ],
      { baseParents: undefined, baseOrder: undefined }
    )
    expect(guarded(result).map(({ op }) => op)).toEqual([
      move("delete", { before: "save" }),
    ])
  })

  it("ignores the key order of baseParents", () => {
    // Unlisted, cancel and archive sort by id between the two.
    const op = move("delete", { before: "archive" })
    const reversed = Object.fromEntries(Object.entries(baseParents).reverse())
    for (const tree of [baseParents, reversed]) {
      const result = resolve([overlay("personal", [op])], {
        baseParents: tree,
        baseOrder: undefined,
      })
      expect(guarded(result).map(({ node }) => node)).toEqual(["delete"])
    }
  })

  describe("held as items", () => {
    const toolbar = {
      "toolbar/actions/save": { primary: true },
      "toolbar/actions/delete": { destructive: true },
    }
    const demote = (id: string) => ({
      op: "demote",
      target: `toolbar/actions/${id}`,
    })
    const promote = (id: string) => ({
      op: "promote",
      target: `toolbar/actions/${id}`,
    })

    it("skips a demote of the primary action", () => {
      const result = resolve([overlay("personal", [demote("save")])], {
        flags: toolbar,
        baseParents: undefined,
        baseOrder: undefined,
      })
      expect(guarded(result)).toMatchObject([
        { op: demote("save"), node: "toolbar/actions/delete" },
      ])
    })

    it("applies a demote and a promote of the destructive action", () => {
      const result = resolve(
        [overlay("personal", [demote("delete"), promote("delete")])],
        { flags: toolbar, baseParents: undefined, baseOrder: undefined }
      )
      expect(guarded(result)).toEqual([])
    })

    it("skips a promote above a demoted primary action", () => {
      const result = resolve(
        [
          overlay("team", [demote("delete"), demote("save")]),
          overlay("personal", [promote("delete")]),
        ],
        { flags: toolbar, baseParents: undefined, baseOrder: undefined }
      )
      expect(guarded(result)).toMatchObject([
        {
          layer: "personal",
          op: promote("delete"),
          conflictsWith: [demote("save")],
        },
      ])
    })
  })

  describe("in wrappers", () => {
    const wrap = (items: string[], id = "w") => ({
      op: "wrap",
      target: "actions",
      id,
      items,
      mode: "row",
    })
    const wrapper = (id = "w") => `actions/slots/${id}`

    it.each([
      ["pinned to the start", { op: "pin", target: wrapper(), where: "start" }],
      [
        "moved before the primary action",
        { op: "move", target: wrapper(), to: { before: "save" } },
      ],
      [
        "moved right after the primary action",
        { op: "move", target: wrapper(), to: { after: "save" } },
      ],
    ])("skips a wrapper of the destructive action %s", (_, op) => {
      const result = resolve([
        overlay("team", [wrap(["delete", "archive"])]),
        overlay("personal", [op]),
      ])
      expect(guarded(result)).toMatchObject([
        {
          layer: "personal",
          op,
          node: "delete",
          conflictsWith: [wrap(["delete", "archive"])],
        },
      ])
    })

    it("skips a move before a wrapper of the primary action", () => {
      const op = move("delete", { before: "w" })
      const result = resolve([
        overlay("personal", [wrap(["save", "cancel"]), op]),
      ])
      expect(guarded(result)).toMatchObject([{ op, node: "delete" }])
    })

    it("doesn't count an empty or hidden wrapper as between them", () => {
      const hideCancel = { op: "hide", target: slot("cancel") }
      const hideArchive = { op: "hide", target: slot("archive") }
      const hideWrapper = { op: "hide", target: wrapper() }
      const result = resolve([
        overlay("personal", [
          wrap(["cancel", "archive"]),
          hideCancel,
          hideArchive,
          hideWrapper,
        ]),
      ])
      expect(guarded(result).map(({ op }) => op)).toEqual([
        hideArchive,
        hideWrapper,
      ])
    })

    it("applies a wrap that keeps them apart", () => {
      const result = resolve([
        overlay("personal", [wrap(["cancel", "archive"]), wrap(["save"], "v")]),
      ])
      expect(guarded(result)).toEqual([])
    })
  })

  describe("conflictsWith", () => {
    it.each([
      [
        "hid",
        { op: "hide", target: slot("archive") },
        { op: "hide", target: slot("cancel") },
      ],
      [
        "hid",
        { op: "hide", target: slot("archive") },
        move("cancel", { into: "side" }),
      ],
      [
        "collapsed",
        collapse(["archive"]),
        { op: "hide", target: slot("cancel") },
      ],
      [
        "moved away",
        move("cancel", { after: "delete" }),
        { op: "hide", target: slot("archive") },
      ],
    ])(
      "lists the lower op that %s an action between them",
      (_, team, personal) => {
        const result = resolve([
          overlay("team", [team]),
          overlay("personal", [personal]),
        ])
        expect(guarded(result)).toMatchObject([
          { layer: "personal", op: personal, conflictsWith: [team] },
        ])
      }
    )

    it("stays empty when the op breaks the rule alone", () => {
      const team = { op: "hide", target: slot("archive") }
      const personal = move("delete", { after: "save" })
      const result = resolve([
        overlay("team", [team]),
        overlay("personal", [personal]),
      ])
      expect(guarded(result)).toMatchObject([
        { op: personal, conflictsWith: [] },
      ])
    })
  })

  describe("without baseOrder", () => {
    const unordered = { baseParents: undefined, baseOrder: undefined }

    it.each([
      ["a hide", { op: "hide", target: "actions/slots/other" }],
      ["a show", { op: "show", target: "actions/slots/other" }],
    ])(
      "doesn't let %s of a node it doesn't know change what is judged",
      (_, unrelated) => {
        const op = move("delete", { after: "save" })
        const alone = resolve([overlay("team", [op])], unordered)
        const both = resolve(
          [overlay("team", [op]), overlay("personal", [unrelated])],
          unordered
        )
        expect(guarded(both)).toEqual(guarded(alone))
      }
    )
  })

  describe("groups", () => {
    it("keeps a node's slots and its item collections apart", () => {
      const mixed = {
        "page/slots/actions/slots/save": { primary: true },
        "actions/actions/remove": { destructive: true },
        "actions/items/open": { primary: true },
      }
      const op = {
        op: "move",
        target: "actions/actions/remove",
        to: { before: "save" },
      }
      const result = resolve([overlay("personal", [op])], {
        flags: mixed,
        baseOrder: undefined,
      })
      expect(guarded(result)).toEqual([])
    })

    it("lets a destructive action leave for another node", () => {
      const op = move("delete", { into: "page" })
      const result = resolve(
        [overlay("personal", [op, move("delete", { before: "actions" })])],
        { baseParents: { ...baseParents, actions: "page" } }
      )
      expect(guarded(result)).toEqual([])
    })
  })

  it("rejects an overlay with such an op in validateOverlay", () => {
    const result = validateOverlay(
      stored(
        "personal",
        [pin("delete", "start")],
        "01JBQ3V8Z7XKQ2M4N5P6ZZZZZZ"
      ),
      { layers: { overlays: [], surface, flags, baseParents, baseOrder } }
    )
    expect(result.error?.issues).toMatchObject([
      {
        path: ["ops", 0],
        message:
          "The item delete is destructive, so it can't sit next to or above its group's primary action",
      },
    ])
  })
})

describe("primary actions", () => {
  it("throws a TypeError for two primary actions in one node", () => {
    expect(() =>
      resolveLayers([], {
        surface,
        flags: {
          "page/slots/actions/slots/save": { primary: true },
          "actions/slots/send": { primary: true },
        },
      })
    ).toThrow(
      new TypeError("flags put two primary actions, save and send, in actions")
    )
  })

  it("throws when the node tree puts two primary actions together", () => {
    expect(() =>
      validateOverlay(
        stored("personal", [pin("save", "end")], "01JBQ3V8Z7XKQ2M4N5P6ZZZZZZ"),
        {
          layers: {
            overlays: [],
            surface,
            flags: { save: { primary: true }, send: { primary: true } },
            baseParents: { save: "actions", send: "actions" },
          },
        }
      )
    ).toThrow(
      new TypeError(
        "layers.baseParents put two primary actions, save and send, in actions"
      )
    )
  })

  it("accepts one primary action per group", () => {
    expect(() =>
      resolveLayers([], {
        surface,
        flags: {
          "page/slots/actions/slots/save": { primary: true },
          "page/slots/dialog/slots/confirm": { primary: true },
          "actions/actions/new": { primary: true },
          "actions/items/open": { primary: true },
        },
      })
    ).not.toThrow()
  })
})

describe("on random op stacks", () => {
  // A fixed seed keeps the runs the same on every machine.
  function random(seed: number) {
    let state = seed
    return () => {
      state = (state + 0x6d2b79f5) | 0
      let next = Math.imul(state ^ (state >>> 15), 1 | state)
      next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next
      return ((next ^ (next >>> 14)) >>> 0) / 4294967296
    }
  }

  const ids = ["save", "cancel", "export", "archive", "delete"]
  const items = ["save", "copy", "print", "delete"]
  const tree = {
    page: null,
    actions: "page",
    save: "actions",
    cancel: "actions",
    export: "actions",
    archive: "actions",
    delete: "actions",
    side: "page",
    toolbar: "page",
  }
  const order = {
    actions: ids,
    "toolbar/actions": items,
    page: ["actions", "side", "toolbar"],
  }
  const fuzzFlags = {
    ...flags,
    "page/slots/actions/slots/archive": { critical: true },
    "toolbar/actions/save": { primary: true },
    "toolbar/actions/delete": { destructive: true },
  }
  const layers: Layer[] = ["org", "team", "personal", "session"]
  const item = (id: string) => `toolbar/actions/${id}`

  function randomOp(next: () => number) {
    const pick = <T>(list: readonly T[]) =>
      list[Math.floor(next() * list.length)] as T
    const id = pick(ids)
    const other = pick([...ids, "w", "v", "x"].filter((each) => each !== id))
    const subset = ids.filter(() => next() < 0.4)
    const one = pick(items)
    const another = pick(items.filter((each) => each !== one))
    return pick([
      () => move(id, { before: other }),
      () => move(id, { after: other }),
      () => move(id, { index: Math.floor(next() * 5) }),
      () => move(id, { into: pick(["side", "actions", "w"]) }),
      () => pin(pick([id, "w"]), pick(["start", "end", "sticky", "none"])),
      () => collapse([pick([id, "w"])], pick(["more", "none"])),
      () => ({ op: pick(["hide", "show"]), target: slot(pick([id, "w"])) }),
      () => ({
        op: "wrap",
        target: "actions",
        id: pick(["w", "v"]),
        items: subset.length > 0 ? subset : [id],
        mode: "row",
      }),
      () => ({
        op: "insert",
        target: pick(["actions", "w"]),
        node: { id: "x", kind: "stat", dataset: "orders" },
        at: pick([{ before: id }, { after: id }, { index: 1 }]),
      }),
      () => ({ op: "remove", target: pick(["w", "v", "x"]) }),
      () => ({
        op: "move",
        target: item(one),
        to: pick([
          { before: another },
          { after: another },
          { index: Math.floor(next() * 4) },
        ]),
      }),
      () => ({
        op: "pin",
        target: item(one),
        where: pick(["start", "end", "none"]),
      }),
      () => ({ op: pick(["promote", "demote"]), target: item(one) }),
      () => ({
        op: "collapse",
        target: "toolbar",
        items: [one],
        into: pick(["more", "none"]),
      }),
      () => ({ op: pick(["hide", "show"]), target: item(one) }),
    ])()
  }

  interface Shown {
    readonly id: string
    readonly shown: boolean
    readonly overflow: boolean
  }

  // Breaks the rule when the destructive action renders above the primary
  // one, or right after it with no shown action between them.
  function breaks(
    order: readonly Shown[],
    destructive: string,
    primary: string
  ) {
    const action = order.find(({ id }) => id === destructive)
    const save = order.find(({ id }) => id === primary)
    if (!save || !action) {
      return false
    }
    if (save.overflow !== action.overflow) {
      return save.overflow
    }
    const shown = order
      .filter(
        (entry) =>
          entry.overflow === action.overflow &&
          (entry.shown || entry === save || entry === action)
      )
      .map(({ id }) => id)
    const gap = shown.indexOf(destructive) - shown.indexOf(primary)
    return gap < 0 || gap === 1
  }

  // What a region renders, with each wrapper's nodes in its place.
  function flattened(
    entries: readonly RegionEntry[],
    hidden = false,
    collapsed = false
  ): Shown[] {
    return entries.flatMap((entry) => {
      const shown = !hidden && entry.visible
      const overflow = collapsed || entry.collapsed !== undefined
      return entry.kind === "wrapper"
        ? flattened(entry.entries, !shown, overflow)
        : [{ id: entry.id, shown, overflow }]
    })
  }

  // The toolbar's items in order: the kept item ops replayed on a region of
  // slots, where a promote or demote keeps the item in place like `pin none`.
  function toolbarOrder(result: ResolvedLayers): Shown[] {
    const skipped = new Set(result.skipped.map(({ check }) => check))
    const mirrored = result.overlays.flatMap((loaded) => {
      const ops = loaded.ops.flatMap((check) => {
        if (skipped.has(check) || check.status !== "valid") {
          return []
        }
        const op: Record<string, unknown> = { ...check.op }
        if (op["target"] === "toolbar") {
          return [{ ...op, target: "mirror" }]
        }
        const target = String(op["target"])
        if (!target.startsWith("toolbar/actions/")) {
          return []
        }
        const id = `mirror/slots/${target.slice("toolbar/actions/".length)}`
        return op["op"] === "promote" || op["op"] === "demote"
          ? [{ op: "pin", target: id, where: "none" }]
          : [{ ...op, target: id }]
      })
      return ops.length > 0 ? [overlay(loaded.layer, ops)] : []
    })
    const mirror = resolveLayers(mirrored, { surface })
    return flattened(
      resolveRegion(mirror, { id: "mirror", slots: items }).entries
    ).map((entry) => {
      const position = result.placements.get(item(entry.id))?.position
      return {
        ...entry,
        overflow:
          entry.overflow ||
          (position !== undefined &&
            "promoted" in position &&
            !position.promoted),
      }
    })
  }

  function shuffled<T>(list: readonly T[], next: () => number) {
    const copy = [...list]
    for (let index = copy.length - 1; index > 0; index--) {
      const swap = Math.floor(next() * (index + 1))
      ;[copy[index], copy[swap]] = [copy[swap] as T, copy[index] as T]
    }
    return copy
  }

  const reshuffle = <T>(record: Record<string, T>, next: () => number) =>
    Object.fromEntries(shuffled(Object.entries(record), next))

  function stack(next: () => number) {
    return layers.flatMap((layer) =>
      next() < 0.6
        ? [
            overlay(
              layer,
              Array.from({ length: 1 + Math.floor(next() * 5) }, () =>
                randomOp(next)
              )
            ),
          ]
        : []
    )
  }

  it("never leaves a destructive action next to or above the primary one, in any input order", () => {
    const next = random(20261120)
    let skips = 0
    for (let run = 0; run < 150; run++) {
      const overlays = stack(next)
      const options = { flags: fuzzFlags, baseParents: tree, baseOrder: order }
      const result = resolve(overlays, options)
      const region = flattened(
        resolveRegion(result, { id: "actions", slots: ids }).entries
      )
      expect(breaks(region, "delete", "save")).toBe(false)
      expect(breaks(toolbarOrder(result), "delete", "save")).toBe(false)
      skips += guarded(result).filter(
        ({ guardrail }) => guardrail === "stays-clear"
      ).length

      const reordered = resolve(shuffled(overlays, next), {
        flags: reshuffle(fuzzFlags, next),
        baseParents: reshuffle(tree, next),
        baseOrder: reshuffle(order, next),
      })
      expect(guarded(reordered)).toEqual(guarded(result))
      expect(reordered.placements).toEqual(result.placements)
      expect(reordered.properties).toEqual(result.properties)
    }
    // The rule must have had something to stop.
    expect(skips).toBeGreaterThan(60)
  })

  it("judges each op apart from ops on nodes it doesn't know, without baseOrder", () => {
    const next = random(1120)
    const options = {
      flags: fuzzFlags,
      baseParents: undefined,
      baseOrder: undefined,
    }
    for (let run = 0; run < 150; run++) {
      const overlays = stack(next)
      const unrelated = {
        op: next() < 0.5 ? "hide" : "show",
        target: next() < 0.5 ? "actions/slots/other" : "toolbar/actions/other",
      }
      const layer = layers[Math.floor(next() * layers.length)] ?? "session"
      const before = guarded(resolve(overlays, options))
      const after = guarded(
        resolve([...overlays, overlay(layer, [unrelated])], options)
      )
      expect(after).toEqual(before)
    }
  })
})

describe("baseOrder", () => {
  it.each([
    [["save"], "baseOrder must be a plain object of children by node id"],
    [{ actions: "save" }, 'baseOrder["actions"] must be an array of ids'],
    [{ actions: ["Save"] }, 'baseOrder["actions"] must be an array of ids'],
    [
      { "actions/slots": ["save"] },
      'baseOrder["actions/slots"] must be an array of ids',
    ],
    [
      { "actions/actions/x": ["a"] },
      'baseOrder["actions/actions/x"] must be an array of ids',
    ],
    [
      { actions: ["save", "save"] },
      'baseOrder["actions"] lists a child more than once',
    ],
    [
      { actions: ["save"], side: ["save"] },
      "baseOrder lists save in side, but its parent is actions",
    ],
    [
      { "ghost/actions": ["save"] },
      "baseOrder names ghost, which isn't in the node tree",
    ],
    [
      { actions: ["save", "send"] },
      "baseOrder names send, which isn't in the node tree",
    ],
    [
      { actions: ["ghost"] },
      "baseOrder names ghost, which isn't in the node tree",
    ],
    [
      { side: ["save"] },
      "baseOrder lists save in side, but its parent is actions",
    ],
  ])("throws a TypeError for %j", (order, message) => {
    expect(() =>
      resolveLayers([], {
        surface,
        flags,
        baseParents,
        baseOrder: order as never,
      })
    ).toThrow(new TypeError(message))
  })

  it("checks a child's parent against its flag without a node tree", () => {
    expect(() =>
      resolveLayers([], {
        surface,
        flags,
        baseOrder: { side: ["delete"] },
      })
    ).toThrow(
      new TypeError("baseOrder lists delete in side, but its parent is actions")
    )
  })

  it("throws from validateOverlay whatever the input", () => {
    expect(() =>
      validateOverlay(null, {
        layers: {
          overlays: [],
          surface,
          flags,
          baseOrder: { actions: ["save", "save"] },
        },
      })
    ).toThrow(
      new TypeError('layers.baseOrder["actions"] lists a child more than once')
    )
  })

  it("supplies the parents baseParents leaves out", () => {
    const op = pin("delete", "start")
    const result = resolve([overlay("personal", [op])], {
      flags: { save: { primary: true }, delete: { destructive: true } },
      baseParents: undefined,
    })
    expect(guarded(result)).toMatchObject([{ op, node: "delete" }])
  })

  it("throws for two primary actions it puts in one node", () => {
    expect(() =>
      resolveLayers([], {
        surface,
        flags: { save: { primary: true }, send: { primary: true } },
        baseOrder: { actions: ["save", "send"] },
      })
    ).toThrow(
      new TypeError(
        "baseOrder put two primary actions, save and send, in actions"
      )
    )
  })

  it("orders a node's items", () => {
    const toolbar = {
      "toolbar/actions/save": { primary: true },
      "toolbar/actions/delete": { destructive: true },
    }
    const op = {
      op: "move",
      target: "toolbar/actions/delete",
      to: { before: "export" },
    }
    const run = (order?: Record<string, string[]>) =>
      guarded(
        resolve([overlay("personal", [op])], {
          flags: toolbar,
          baseParents: undefined,
          baseOrder: order,
        })
      ).map(({ node }) => node)
    // Unlisted, export isn't known, so the move keeps delete in place.
    expect(run()).toEqual([])
    expect(
      run({ "toolbar/actions": ["save", "export", "print", "delete"] })
    ).toEqual(["toolbar/actions/delete"])
  })
})
