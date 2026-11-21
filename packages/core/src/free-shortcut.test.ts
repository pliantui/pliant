import { describe, expect, it } from "vitest"

import type { Layer } from "@pliantui/contract"

import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import {
  resolveLayers,
  type ResolvedLayers,
  type ResolveLayersOptions,
} from "./resolve-layers"
import { validateOverlay } from "./validate-overlay"

const surface = "/orders"

const scopes = {
  org: { org: "acme" },
  team: { team: "sales" },
} as const

const exportAction = "orders-toolbar/actions/export"
const printAction = "orders-toolbar/actions/print"

let count = 0

function stored(layer: Layer, ops: unknown[]) {
  count++
  return {
    v: 1,
    id: `01JBQ3V8Z7XKQ2M4N5P6${String(count).padStart(6, "0")}`,
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

function overlay(layer: Layer, ops: unknown[]): LoadedOverlay {
  const result = loadOverlay(stored(layer, ops))
  if (!result.success) {
    throw result.error
  }
  return result.data
}

const bind = (target: string, keys: string) => ({
  op: "bindShortcut",
  target,
  keys,
})

function resolve(
  overlays: LoadedOverlay[],
  options: Partial<ResolveLayersOptions> = {}
) {
  return resolveLayers(overlays, { surface, ...options })
}

const shortcutOf = (result: ResolvedLayers, id: string) => {
  const op = result.properties.get(id)?.get("shortcut")?.winner.check.op
  return op?.op === "bindShortcut" ? op.keys : undefined
}

function skips({ skipped }: ResolvedLayers) {
  return skipped.flatMap((entry) =>
    entry.reason === "guardrail"
      ? [
          {
            layer: entry.overlay.layer,
            guardrail: entry.guardrail,
            node: entry.node,
            conflictsWith: entry.conflictsWith.map(({ check }) => check.op),
          },
        ]
      : []
  )
}

describe("shortcut bindings", () => {
  it("applies a binding to free keys", () => {
    const result = resolve([overlay("personal", [bind(exportAction, "mod+e")])])
    expect(shortcutOf(result, exportAction)).toBe("mod+e")
    expect(result.skipped).toEqual([])
  })

  it.each([
    ["a key with no modifier", "k"],
    ["shift alone", "shift+k"],
    ["alt alone", "alt+k"],
    ["alt and shift alone", "alt+shift+arrowleft"],
    ["ctrl and alt, AltGr on Windows", "ctrl+alt+k"],
    ["mod and alt, AltGr on Windows", "mod+alt+k"],
    ["the Windows key", "meta+k"],
    ["a new tab", "mod+t"],
    ["closing the tab", "mod+w"],
    ["reloading", "mod+r"],
    ["copying", "mod+c"],
    ["find", "mod+f"],
    ["switching tabs", "ctrl+tab"],
    ["developer tools on Windows", "mod+shift+i"],
    ["minimizing on macOS", "mod+m"],
    ["Spaces on macOS", "ctrl+arrowleft"],
    ["Force Quit on macOS", "mod+alt+escape"],
    ["a function key", "f5"],
    ["the next tab on Windows", "ctrl+pagedown"],
    ["the previous tab on Windows", "ctrl+pageup"],
    ["closing the tab on Windows", "mod+f4"],
    ["the Start menu", "mod+escape"],
    ["the Task Manager", "mod+shift+escape"],
    ["VoiceOver on macOS", "mod+f5"],
    ["the previous tab on macOS", "mod+shift+["],
    ["the next tab on macOS", "mod+shift+]"],
  ])("skips a binding to %s", (_, keys) => {
    const result = resolve([overlay("personal", [bind(exportAction, keys)])])
    expect(shortcutOf(result, exportAction)).toBeUndefined()
    expect(skips(result)).toEqual([
      {
        layer: "personal",
        guardrail: "free-shortcut",
        node: exportAction,
        conflictsWith: [],
      },
    ])
  })

  it.each([
    "mod+k",
    "mod+shift+k",
    "ctrl+k",
    "ctrl+shift+e",
    "ctrl+m",
    "mod+s",
  ])("allows %s", (keys) => {
    const result = resolve([overlay("personal", [bind(exportAction, keys)])])
    expect(shortcutOf(result, exportAction)).toBe(keys)
  })

  it("skips a binding to keys the app reserves, on either platform", () => {
    const result = resolve(
      [
        overlay("personal", [
          bind(exportAction, "ctrl+k"),
          bind(printAction, "mod+b"),
        ]),
      ],
      { reservedShortcuts: ["mod+k", "mod+b"] }
    )
    expect(shortcutOf(result, exportAction)).toBeUndefined()
    expect(shortcutOf(result, printAction)).toBeUndefined()
    expect(skips(result).map(({ node }) => node)).toEqual([
      exportAction,
      printAction,
    ])
  })

  it("skips a binding to keys the app reserves on macOS only", () => {
    const result = resolve(
      [overlay("personal", [bind(exportAction, "mod+e")])],
      { reservedShortcuts: ["meta+e"] }
    )
    expect(shortcutOf(result, exportAction)).toBeUndefined()
  })

  it("skips the later binding of keys another action takes", () => {
    const team = overlay("team", [bind(exportAction, "mod+e")])
    const personal = overlay("personal", [bind(printAction, "ctrl+e")])
    const result = resolve([personal, team])
    expect(shortcutOf(result, exportAction)).toBe("mod+e")
    expect(shortcutOf(result, printAction)).toBeUndefined()
    expect(skips(result)).toEqual([
      {
        layer: "personal",
        guardrail: "free-shortcut",
        node: printAction,
        conflictsWith: [bind(exportAction, "mod+e")],
      },
    ])
  })

  it("lets keys on one platform only stay apart from keys on the other", () => {
    const result = resolve([
      overlay("personal", [
        bind(exportAction, "ctrl+e"),
        bind(printAction, "mod+shift+e"),
        bind("orders-toolbar/actions/copy", "ctrl+shift+e"),
      ]),
    ])
    expect(shortcutOf(result, exportAction)).toBe("ctrl+e")
    expect(shortcutOf(result, printAction)).toBe("mod+shift+e")
    expect(skips(result).map(({ node }) => node)).toEqual([
      "orders-toolbar/actions/copy",
    ])
  })

  it("lets an action take keys again, and frees the keys it leaves", () => {
    const result = resolve([
      overlay("team", [bind(exportAction, "mod+e")]),
      overlay("personal", [
        bind(exportAction, "mod+e"),
        bind(exportAction, "mod+b"),
        bind(printAction, "mod+e"),
      ]),
    ])
    expect(shortcutOf(result, exportAction)).toBe("mod+b")
    expect(shortcutOf(result, printAction)).toBe("mod+e")
    expect(result.skipped).toEqual([])
  })

  it("counts the same action under any address as one", () => {
    const result = resolve([
      overlay("personal", [
        bind(`page/slots/${exportAction}`, "mod+e"),
        bind(exportAction, "ctrl+e"),
      ]),
    ])
    expect(shortcutOf(result, exportAction)).toBe("ctrl+e")
    expect(result.skipped).toEqual([])
  })

  it("throws when the reserved keys aren't keys bindShortcut takes", () => {
    expect(() => resolve([], { reservedShortcuts: ["Ctrl+K"] })).toThrow(
      new TypeError(
        "reservedShortcuts[0] must be keys as bindShortcut takes them"
      )
    )
    expect(() =>
      resolve([], {
        reservedShortcuts: "mod+k" as unknown as readonly string[],
      })
    ).toThrow(new TypeError("reservedShortcuts must be an array of keys"))
  })

  it("rejects an overlay that binds reserved or taken keys", () => {
    const team = stored("team", [bind(exportAction, "mod+e")])
    const input = stored("personal", [
      bind(printAction, "mod+t"),
      bind("orders-toolbar/actions/copy", "ctrl+e"),
      bind("orders-toolbar/actions/run", "mod+k"),
      bind("orders-toolbar/actions/send", "mod+b"),
    ])
    const result = validateOverlay(input, {
      layers: { overlays: [team], surface },
      reservedShortcuts: ["mod+k"],
    })
    expect(result.error?.issues).toEqual([
      {
        code: "custom",
        path: ["ops", 0],
        message: `The item ${printAction} can't take mod+t, which is reserved`,
      },
      {
        code: "custom",
        path: ["ops", 1],
        message: `The item orders-toolbar/actions/copy can't take ctrl+e, which ${exportAction} already takes`,
      },
      {
        code: "custom",
        path: ["ops", 2],
        message:
          "The item orders-toolbar/actions/run can't take mod+k, which is reserved",
      },
    ])
    expect(() => validateOverlay(input, { reservedShortcuts: [""] })).toThrow(
      new TypeError(
        "reservedShortcuts[0] must be keys as bindShortcut takes them"
      )
    )
  })

  it("rejects reserved keys without the layers below", () => {
    const input = stored("personal", [
      bind(printAction, "mod+t"),
      bind("orders-toolbar/actions/run", "ctrl+k"),
      bind("orders-toolbar/actions/copy", "mod+b"),
      bind("orders-toolbar/actions/send", "mod+b"),
    ])
    expect(validateOverlay(input).error?.issues).toEqual([
      {
        code: "custom",
        path: ["ops", 0],
        message: `The item ${printAction} can't take mod+t, which is reserved`,
      },
    ])
    expect(
      validateOverlay(input, {
        reservedShortcuts: ["mod+k"],
      }).error?.issues.map(({ path }) => path)
    ).toEqual([
      ["ops", 0],
      ["ops", 1],
    ])
  })

  it("rejects reserved keys in an overlay whose envelope is invalid", () => {
    const input = { ...stored("personal", [bind(printAction, "mod+t")]), v: 2 }
    expect(
      validateOverlay(input).error?.issues.map(({ message }) => message)
    ).toContain(`The item ${printAction} can't take mod+t, which is reserved`)
  })
})
