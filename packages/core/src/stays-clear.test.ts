import { describe, expect, it } from "vitest"

import type { Flags, Layer } from "@pliantui/contract"

import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import {
  resolveLayers,
  type ResolvedLayers,
  type ResolveLayersOptions,
} from "./resolve-layers"
import { resolveRegion } from "./resolve-region"
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

// The group renders save, cancel, archive, delete.
const baseParents = {
  page: null,
  actions: "page",
  save: "actions",
  cancel: "actions",
  archive: "actions",
  delete: "actions",
  side: "page",
}

function resolve(
  overlays: LoadedOverlay[],
  options: Partial<ResolveLayersOptions> = {}
): ResolvedLayers {
  return resolveLayers(overlays, { surface, flags, baseParents, ...options })
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
      { baseParents: undefined }
    )
    expect(guarded(result).map(({ op }) => op)).toEqual([
      move("delete", { before: "save" }),
    ])
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
      })
      expect(guarded(result)).toMatchObject([
        { op: demote("save"), node: "toolbar/actions/delete" },
      ])
    })

    it("applies a demote and a promote of the destructive action", () => {
      const result = resolve(
        [overlay("personal", [demote("delete"), promote("delete")])],
        { flags: toolbar, baseParents: undefined }
      )
      expect(guarded(result)).toEqual([])
    })

    it("skips a promote above a demoted primary action", () => {
      const result = resolve(
        [
          overlay("team", [demote("delete"), demote("save")]),
          overlay("personal", [promote("delete")]),
        ],
        { flags: toolbar, baseParents: undefined }
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

  it("rejects an overlay with such an op in validateOverlay", () => {
    const result = validateOverlay(
      stored(
        "personal",
        [pin("delete", "start")],
        "01JBQ3V8Z7XKQ2M4N5P6ZZZZZZ"
      ),
      { layers: { overlays: [], surface, flags, baseParents } }
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

  it("accepts one primary action per node", () => {
    expect(() =>
      resolveLayers([], {
        surface,
        flags: {
          "page/slots/actions/slots/save": { primary: true },
          "page/slots/dialog/slots/confirm": { primary: true },
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

  const ids = ["save", "cancel", "archive", "delete", "export"]
  const tree = {
    page: null,
    actions: "page",
    save: "actions",
    cancel: "actions",
    export: "actions",
    archive: "actions",
    delete: "actions",
    side: "page",
  }
  const layers: Layer[] = ["org", "team", "personal", "session"]

  function randomOp(next: () => number) {
    const pick = <T>(list: readonly T[]) =>
      list[Math.floor(next() * list.length)] as T
    const id = pick(ids)
    const other = pick(ids.filter((candidate) => candidate !== id))
    return pick([
      () => move(id, { before: other }),
      () => move(id, { after: other }),
      () => move(id, { index: Math.floor(next() * 5) }),
      () => move(id, { into: pick(["side", "actions"]) }),
      () => pin(id, pick(["start", "end", "sticky", "none"])),
      () => collapse([id], pick(["more", "none"])),
      () => ({ op: pick(["hide", "show"]), target: slot(id) }),
    ])()
  }

  // Breaks the rule when the destructive action renders above the primary
  // one, or right after it with no shown action between them.
  function breaksRule(result: ResolvedLayers) {
    const entries = resolveRegion(result, {
      id: "actions",
      slots: Object.keys(tree).filter(
        (id) => tree[id as keyof typeof tree] === "actions"
      ),
    }).entries
    const save = entries.find(({ id }) => id === "save")
    const action = entries.find(({ id }) => id === "delete")
    if (!save || !action) {
      return false
    }
    if (!save.collapsed !== !action.collapsed) {
      return !action.collapsed
    }
    const shown = entries
      .filter(
        (entry) =>
          !entry.collapsed === !action.collapsed &&
          (entry.visible || entry === save || entry === action)
      )
      .map(({ id }) => id)
    const gap = shown.indexOf("delete") - shown.indexOf("save")
    return gap < 0 || gap === 1
  }

  function shuffled<T>(list: readonly T[], next: () => number) {
    const copy = [...list]
    for (let index = copy.length - 1; index > 0; index--) {
      const swap = Math.floor(next() * (index + 1))
      ;[copy[index], copy[swap]] = [copy[swap] as T, copy[index] as T]
    }
    return copy
  }

  it("never leaves the destructive action next to or above the primary one, in any input order", () => {
    const next = random(20261120)
    let skips = 0
    for (let run = 0; run < 300; run++) {
      const overlays = layers.flatMap((layer) =>
        next() < 0.6
          ? [
              overlay(
                layer,
                Array.from({ length: 1 + Math.floor(next() * 4) }, () =>
                  randomOp(next)
                )
              ),
            ]
          : []
      )
      const options = {
        flags: { ...flags, "actions/slots/archive": { critical: true } },
        baseParents: tree,
      }
      const result = resolve(overlays, options)
      expect(breaksRule(result)).toBe(false)
      skips += guarded(result).filter(
        ({ guardrail }) => guardrail === "stays-clear"
      ).length

      const reordered = resolve(shuffled(overlays, next), {
        ...options,
        flags: Object.fromEntries(
          shuffled(Object.entries(options.flags), next)
        ),
      })
      expect(guarded(reordered)).toEqual(guarded(result))
      expect(reordered.placements).toEqual(result.placements)
      expect(reordered.properties).toEqual(result.properties)
    }
    // The rule must have had something to stop.
    expect(skips).toBeGreaterThan(50)
  })
})
