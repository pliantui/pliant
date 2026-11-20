import { describe, expect, it } from "vitest"

import type { Flags, Layer } from "@pliantui/contract"

import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import { resolveLayers, type ResolvedLayers } from "./resolve-layers"

const surface = "/checkout"

const scopes = {
  org: { org: "acme" },
  team: { team: "sales" },
} as const

function stored(layer: Layer, ops: unknown[], id: string, onSurface = surface) {
  return {
    v: 1,
    id,
    surface: onSurface,
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

function overlay(
  layer: Layer,
  ops: unknown[],
  onSurface = surface
): LoadedOverlay {
  count++
  const result = loadOverlay(
    stored(
      layer,
      ops,
      `01JBQ3V8Z7XKQ2M4N5P6R7S8${String(count).padStart(2, "0")}`,
      onSurface
    )
  )
  if (!result.success) {
    throw result.error
  }
  return result.data
}

const flags: Record<string, Flags> = {
  "page/slots/checkout-actions/slots/pay-now": { critical: true },
  "page/slots/ticket-form/fields/email": { required: true },
  "page/slots/checkout-actions/slots/delete": { destructive: true },
}

function resolve(...overlays: LoadedOverlay[]): ResolvedLayers {
  return resolveLayers(overlays, { surface, flags })
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
          },
        ]
      : []
  )
}

function winner(result: ResolvedLayers, id: string, property: "visible") {
  return result.properties.get(id)?.get(property)?.winner.check.op
}

describe("critical and required nodes", () => {
  it("skips a hide on a critical node", () => {
    const result = resolve(
      overlay("personal", [
        { op: "hide", target: "checkout-actions/slots/pay-now" },
      ])
    )
    expect(guarded(result)).toEqual([
      {
        layer: "personal",
        op: { op: "hide", target: "checkout-actions/slots/pay-now" },
        guardrail: "stays-visible",
        flag: "critical",
        node: "pay-now",
      },
    ])
    expect(winner(result, "pay-now", "visible")).toBeUndefined()
  })

  it("applies the same hide when the node isn't flagged", () => {
    const hide = { op: "hide", target: "checkout-actions/slots/pay-now" }
    const result = resolveLayers([overlay("personal", [hide])], { surface })
    expect(guarded(result)).toEqual([])
    expect(winner(result, "pay-now", "visible")).toEqual(hide)
  })

  it("doesn't protect nodes with other flags", () => {
    const hide = { op: "hide", target: "checkout-actions/slots/delete" }
    const result = resolve(overlay("personal", [hide]))
    expect(guarded(result)).toEqual([])
    expect(winner(result, "delete", "visible")).toEqual(hide)
  })

  it("skips a hide on a node that holds a critical node", () => {
    const result = resolve(
      overlay("team", [{ op: "hide", target: "page/slots/checkout-actions" }])
    )
    expect(guarded(result)).toEqual([
      {
        layer: "team",
        op: { op: "hide", target: "page/slots/checkout-actions" },
        guardrail: "stays-visible",
        flag: "critical",
        node: "pay-now",
      },
    ])
  })

  it("skips a hide and collapse of a required field and its form", () => {
    const ops = [
      { op: "hide", target: "ticket-form/fields/email" },
      { op: "hide", target: "page/slots/ticket-form" },
      { op: "collapse", target: "ticket-form", items: ["email"], into: "more" },
      { op: "collapse", target: "page", items: ["ticket-form"], into: "tabs" },
    ]
    const result = resolve(overlay("personal", ops))
    expect(guarded(result).map(({ op, flag }) => [op, flag])).toEqual(
      ops.map((op) => [op, "required"])
    )
  })

  it("keeps a collapse into none, which shows the items again", () => {
    const collapse = {
      op: "collapse",
      target: "checkout-actions",
      items: ["pay-now"],
      into: "more",
    }
    const result = resolve(
      overlay("team", [{ ...collapse }]),
      overlay("personal", [{ ...collapse, into: "none" }])
    )
    expect(guarded(result)).toEqual([])
  })

  it("skips a demote of a critical action", () => {
    const flagged = { "orders-toolbar/actions/export": { critical: true } }
    const demote = { op: "demote", target: "orders-toolbar/actions/export" }
    const result = resolveLayers([overlay("personal", [demote])], {
      surface,
      flags: flagged,
    })
    expect(guarded(result)).toMatchObject([{ op: demote, flag: "critical" }])
    expect(result.placements.get("orders-toolbar/actions/export")?.winner).toBe(
      undefined
    )
  })

  it("skips a higher layer's move into a node a lower layer hid", () => {
    const hide = { op: "hide", target: "sidebar" }
    const move = {
      op: "move",
      target: "checkout-actions/slots/pay-now",
      to: { into: "sidebar" },
    }
    const result = resolve(overlay("team", [hide]), overlay("personal", [move]))
    expect(guarded(result)).toMatchObject([{ layer: "personal", op: move }])
    expect(winner(result, "sidebar", "visible")).toEqual(hide)
    expect(result.placements.get("pay-now")?.container).not.toBe("sidebar")
  })

  it("skips a higher layer's hide of a node a lower layer moved it into", () => {
    const move = {
      op: "move",
      target: "checkout-actions/slots/pay-now",
      to: { into: "sidebar" },
    }
    const hide = { op: "hide", target: "sidebar" }
    const result = resolve(overlay("team", [move]), overlay("personal", [hide]))
    expect(guarded(result)).toMatchObject([{ layer: "personal", op: hide }])
    expect(result.placements.get("pay-now")?.container).toBe("sidebar")
  })

  it("skips a hide of a wrapper that holds a critical node", () => {
    const wrap = {
      op: "wrap",
      target: "checkout-actions",
      id: "pay-group",
      items: ["pay-now", "back"],
      mode: "row",
    }
    const hide = { op: "hide", target: "pay-group" }
    const result = resolve(overlay("personal", [wrap, hide]))
    expect(guarded(result)).toMatchObject([{ op: hide }])
  })

  it("skips a remove of a critical node that was inserted", () => {
    const insert = {
      op: "insert",
      target: "dashboard",
      node: { id: "revenue-chart", kind: "chart", dataset: "orders" },
      at: { index: 0 },
    }
    const remove = { op: "remove", target: "dashboard/slots/revenue-chart" }
    const result = resolveLayers([overlay("team", [insert, remove])], {
      surface,
      flags: { "dashboard/slots/revenue-chart": { critical: true } },
    })
    expect(guarded(result)).toMatchObject([{ op: remove }])
    expect(
      result.properties.get("revenue-chart")?.get("inserted")?.winner.check.op
    ).toEqual(insert)
  })

  it("resolves again until no op breaks a guardrail", () => {
    const orgHide = { op: "hide", target: "checkout-actions" }
    const teamHide = { op: "hide", target: "sidebar" }
    const move = {
      op: "move",
      target: "checkout-actions/slots/pay-now",
      to: { into: "sidebar" },
    }
    const result = resolve(
      overlay("org", [orgHide]),
      overlay("team", [teamHide]),
      overlay("session", [move])
    )
    expect(guarded(result).map(({ layer, op }) => [layer, op])).toEqual([
      ["org", orgHide],
      ["session", move],
    ])
    expect(winner(result, "sidebar", "visible")).toEqual(teamHide)
    expect(winner(result, "checkout-actions", "visible")).toBeUndefined()
  })

  it("throws a TypeError for flags that aren't flags", () => {
    expect(() =>
      resolveLayers([], { surface, flags: { pay: { critcal: true } } as never })
    ).toThrow(TypeError)
    expect(() => resolveLayers([], { surface, flags: [] as never })).toThrow(
      TypeError
    )
  })

  it("skips only the hide when the node is hidden without the other ops", () => {
    const hide = { op: "hide", target: "page/slots/checkout-actions" }
    const wrap = {
      op: "wrap",
      target: "checkout-actions",
      id: "pay-group",
      items: ["pay-now", "back"],
      mode: "row",
    }
    const result = resolve(overlay("org", [hide]), overlay("personal", [wrap]))
    expect(guarded(result).map(({ op }) => op)).toEqual([hide])
    expect(result.placements.get("pay-now")?.container).toBe("pay-group")
  })

  it("skips a wrap that creates a node a lower layer hid", () => {
    const hide = { op: "hide", target: "pay-group" }
    const wrap = {
      op: "wrap",
      target: "checkout-actions",
      id: "pay-group",
      items: ["pay-now", "back"],
      mode: "row",
    }
    const result = resolveLayers(
      [overlay("team", [hide]), overlay("personal", [wrap])],
      {
        surface,
        flags,
        baseIds: ["page", "checkout-actions", "pay-now", "back"],
      }
    )
    expect(guarded(result).map(({ op }) => op)).toEqual([wrap])
  })

  it("skips the highest of the moves that put the node in a hidden node", () => {
    const hide = { op: "hide", target: "sidebar" }
    const intoPanel = {
      op: "move",
      target: "checkout-actions/slots/pay-now",
      to: { into: "panel" },
    }
    const intoSidebar = {
      op: "move",
      target: "page/slots/panel",
      to: { into: "sidebar" },
    }
    const result = resolve(
      overlay("org", [hide]),
      overlay("team", [intoPanel]),
      overlay("personal", [intoSidebar])
    )
    expect(guarded(result).map(({ op }) => op)).toEqual([intoSidebar])
    expect(result.placements.get("pay-now")?.container).toBe("panel")
  })

  it("skips a higher layer's move into a container that collapsed the node", () => {
    const collapse = {
      op: "collapse",
      target: "sidebar",
      items: ["pay-now"],
      into: "more",
    }
    const move = {
      op: "move",
      target: "checkout-actions/slots/pay-now",
      to: { into: "sidebar" },
    }
    const result = resolve(
      overlay("org", [collapse]),
      overlay("personal", [move])
    )
    expect(guarded(result).map(({ op }) => op)).toEqual([move])
  })

  it("combines the flags of addresses of the same node", () => {
    const hide = { op: "hide", target: "page/slots/checkout-actions" }
    const result = resolveLayers([overlay("personal", [hide])], {
      surface,
      flags: {
        "pay-now": { critical: true },
        "page/slots/checkout-actions/slots/pay-now": { destructive: true },
      },
    })
    expect(guarded(result).map(({ op }) => op)).toEqual([hide])
  })

  it("ignores the addresses of overlays for other surfaces", () => {
    const hide = { op: "hide", target: "panel" }
    const result = resolveLayers(
      [
        overlay(
          "personal",
          [{ op: "hide", target: "panel/slots/pay-now" }],
          "/other"
        ),
        overlay("personal", [hide]),
      ],
      { surface, flags: { "pay-now": { critical: true } } }
    )
    expect(guarded(result)).toEqual([])
    expect(winner(result, "panel", "visible")).toEqual(hide)
  })

  it("skips only the hide when a node that holds the node in the base is hidden", () => {
    const move = {
      op: "move",
      target: "page/slots/checkout-actions",
      to: { into: "sidebar" },
    }
    const hide = { op: "hide", target: "sidebar" }
    const wrap = {
      op: "wrap",
      target: "checkout-actions",
      id: "pay-group",
      items: ["pay-now", "back"],
      mode: "row",
    }
    const result = resolve(
      overlay("org", [move]),
      overlay("team", [hide]),
      overlay("personal", [wrap])
    )
    expect(guarded(result).map(({ op }) => op)).toEqual([hide])
    expect(result.placements.get("pay-now")?.container).toBe("pay-group")
  })

  it("skips a move that puts a node into the node it holds", () => {
    const move = {
      op: "move",
      target: "page/slots/checkout-actions",
      to: { into: "pay-now" },
    }
    const result = resolve(overlay("personal", [move]))
    expect(guarded(result).map(({ op }) => op)).toEqual([move])
  })

  it("skips the higher of two moves that make a cycle of containers", () => {
    const intoSidebar = {
      op: "move",
      target: "page/slots/checkout-actions",
      to: { into: "sidebar" },
    }
    const intoActions = {
      op: "move",
      target: "page/slots/sidebar",
      to: { into: "checkout-actions" },
    }
    const result = resolve(
      overlay("team", [intoSidebar]),
      overlay("personal", [intoActions])
    )
    expect(guarded(result)).toMatchObject([
      { layer: "personal", op: intoActions },
    ])
    expect(result.placements.get("checkout-actions")?.container).toBe("sidebar")
  })

  it("lists the other ops involved with a skipped op", () => {
    const move = {
      op: "move",
      target: "checkout-actions/slots/pay-now",
      to: { into: "sidebar" },
    }
    const result = resolve(
      overlay("team", [move]),
      overlay("personal", [{ op: "hide", target: "sidebar" }])
    )
    const [skip] = result.skipped
    expect(
      skip?.reason === "guardrail" &&
        skip.conflictsWith.map(({ check, overlay }) => [
          overlay.layer,
          check.op,
        ])
    ).toEqual([["team", move]])
  })

  it("reports a node flagged both critical and required as critical", () => {
    const result = resolveLayers(
      [overlay("personal", [{ op: "hide", target: "pay-now" }])],
      { surface, flags: { "pay-now": { critical: true, required: true } } }
    )
    expect(guarded(result).map(({ flag }) => flag)).toEqual(["critical"])
  })

  it("reads parents from the targets of ops", () => {
    const hide = { op: "hide", target: "page/slots/checkout-actions" }
    const result = resolveLayers(
      [
        overlay("team", [
          {
            op: "rename",
            target: "checkout-actions/slots/pay-now",
            label: "Pay",
          },
        ]),
        overlay("personal", [hide]),
      ],
      { surface, flags: { "pay-now": { critical: true } } }
    )
    expect(guarded(result).map(({ op }) => op)).toEqual([hide])
  })

  it("reads parents from move … into destinations", () => {
    const hide = { op: "hide", target: "aside" }
    const move = {
      op: "move",
      target: "checkout-actions/slots/pay-now",
      to: { into: "aside/slots/drawer" },
    }
    const result = resolve(overlay("team", [move]), overlay("personal", [hide]))
    expect(guarded(result).map(({ op }) => op)).toEqual([hide])
  })

  it("prefers the parents a flag's address shows over an op's", () => {
    const hidePanel = { op: "hide", target: "panel" }
    const hideActions = { op: "hide", target: "checkout-actions" }
    const result = resolve(
      overlay("team", [
        { op: "rename", target: "panel/slots/pay-now", label: "Pay" },
      ]),
      overlay("personal", [hidePanel, hideActions])
    )
    expect(guarded(result).map(({ op }) => op)).toEqual([hideActions])
    expect(winner(result, "panel", "visible")).toEqual(hidePanel)
  })

  describe("with the base tree", () => {
    const hide = { op: "hide", target: "aside" }
    const move = {
      op: "move",
      target: "checkout-actions/slots/pay-now",
      to: { into: "drawer" },
    }

    it("doesn't trace a node named only by its id without the tree", () => {
      const result = resolve(
        overlay("team", [hide]),
        overlay("personal", [move])
      )
      expect(guarded(result)).toEqual([])
    })

    it("traces it through the tree", () => {
      const result = resolveLayers(
        [overlay("team", [hide]), overlay("personal", [move])],
        { surface, flags, baseParents: { drawer: "aside", aside: null } }
      )
      expect(guarded(result).map(({ op }) => op)).toEqual([move])
    })

    it("ignores the parents that addresses show", () => {
      const hidePanel = { op: "hide", target: "panel" }
      const result = resolveLayers(
        [
          overlay("personal", [
            { op: "rename", target: "panel/slots/pay-now", label: "Pay" },
            hidePanel,
          ]),
        ],
        {
          surface,
          flags: { "pay-now": { critical: true } },
          baseParents: { "checkout-actions": null },
        }
      )
      expect(guarded(result)).toEqual([])
      expect(winner(result, "panel", "visible")).toEqual(hidePanel)
    })

    it("throws a TypeError for a tree that isn't node ids", () => {
      for (const baseParents of [[], { drawer: 4 }, { "Drawer!": null }]) {
        expect(() =>
          resolveLayers([], { surface, baseParents: baseParents as never })
        ).toThrow(TypeError)
      }
    })
  })

  it("throws a TypeError for flags at addresses that aren't addresses", () => {
    expect(() =>
      resolveLayers([], { surface, flags: { "Pay Now": { critical: true } } })
    ).toThrow(TypeError)
  })

  it("throws a TypeError for flags that aren't a plain object", () => {
    const flagMap = new Map([["pay-now", { critical: true }]])
    expect(() =>
      resolveLayers([], { surface, flags: flagMap as never })
    ).toThrow(TypeError)
  })

  it("throws a TypeError when two addresses put a node in different parents", () => {
    expect(() =>
      resolveLayers([], {
        surface,
        flags: {
          "panel/slots/pay-now": { critical: true },
          "checkout-actions/slots/pay-now": { required: true },
        },
      })
    ).toThrow(TypeError)
  })
})
