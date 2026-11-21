import { describe, expect, it } from "vitest"

import type { Layer, Manifest } from "@pliantui/contract"

import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import {
  resolveLayers,
  type ResolvedLayers,
  type ResolveLayersOptions,
} from "./resolve-layers"
import { validateOverlay } from "./validate-overlay"

const surface = "/settings"

const scopes = {
  org: { org: "acme" },
  team: { team: "sales" },
} as const

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

const buttonManifest: Manifest = {
  kind: "button",
  version: 1,
  description: "Clickable action",
  capabilities: {
    props: {
      variant: {
        values: ["default", "outline", "ghost", "destructive", "warning"],
        default: "default",
        semantic: ["destructive", "warning"],
      },
      size: { values: ["sm", "default", "lg"] },
    },
  },
}

const save = "page/slots/account-actions/slots/save"
const remove = "page/slots/account-actions/slots/delete-account"

const manifests = { [save]: buttonManifest, [remove]: buttonManifest }

const setProp = (target: string, prop: string, value: string) => ({
  op: "setProp",
  target,
  prop,
  value,
})

function resolve(
  overlays: LoadedOverlay[],
  options: Partial<ResolveLayersOptions> = {}
) {
  return resolveLayers(overlays, {
    surface,
    manifests,
    flags: { [remove]: { destructive: true } },
    ...options,
  })
}

const propOf = (result: ResolvedLayers, id: string, prop: string) => {
  const op = result.properties.get(id)?.get(`props.${prop}`)?.winner.check.op
  return op?.op === "setProp" ? op.value : undefined
}

function skips({ skipped }: ResolvedLayers) {
  return skipped.flatMap((entry) =>
    entry.reason === "guardrail"
      ? [
          {
            layer: entry.overlay.layer,
            guardrail: entry.guardrail,
            flag: entry.flag,
            node: entry.node,
          },
        ]
      : []
  )
}

describe("semantic variants", () => {
  it("applies a value the manifest leaves to users", () => {
    const result = resolve([
      overlay("personal", [setProp(save, "variant", "outline")]),
    ])
    expect(propOf(result, "save", "variant")).toBe("outline")
    expect(result.skipped).toEqual([])
  })

  it.each(["destructive", "warning"])(
    "skips setting the semantic value %s in any layer",
    (value) => {
      const result = resolve([
        overlay("org", [setProp(save, "variant", value)]),
        overlay("personal", [setProp("save", "variant", value)]),
      ])
      expect(propOf(result, "save", "variant")).toBeUndefined()
      expect(skips(result)).toEqual(
        ["org", "personal"].map((layer) => ({
          layer,
          guardrail: "keeps-meaning",
          flag: undefined,
          node: "save",
        }))
      )
    }
  )

  it("keeps a lower value when a higher layer's semantic value is skipped", () => {
    const result = resolve([
      overlay("team", [setProp(save, "variant", "ghost")]),
      overlay("personal", [setProp(save, "variant", "destructive")]),
    ])
    expect(propOf(result, "save", "variant")).toBe("ghost")
  })

  it("skips any change to a destructive action's variant", () => {
    const result = resolve([
      overlay("personal", [
        setProp(remove, "variant", "outline"),
        setProp(remove, "variant", "default"),
        setProp(remove, "size", "lg"),
      ]),
    ])
    expect(propOf(result, "delete-account", "variant")).toBeUndefined()
    expect(propOf(result, "delete-account", "size")).toBe("lg")
    expect(skips(result)).toEqual([
      {
        layer: "personal",
        guardrail: "keeps-meaning",
        flag: "destructive",
        node: "delete-account",
      },
      {
        layer: "personal",
        guardrail: "keeps-meaning",
        flag: "destructive",
        node: "delete-account",
      },
    ])
  })

  it("applies any value to a node with no manifest", () => {
    const result = resolve([
      overlay("personal", [
        setProp("page/slots/other", "variant", "destructive"),
      ]),
    ])
    expect(propOf(result, "other", "variant")).toBe("destructive")
  })

  it("throws on manifests that aren't valid", () => {
    expect(() =>
      resolve([], {
        manifests: { [save]: { kind: "button" } as unknown as Manifest },
      })
    ).toThrow(
      new TypeError(`manifests["${save}"] must be a manifest at an address`)
    )
    expect(() =>
      resolve([], { manifests: { "Not an address": buttonManifest } })
    ).toThrow(
      new TypeError(
        `manifests["Not an address"] must be a manifest at an address`
      )
    )
    expect(() =>
      resolve([], {
        manifests: { [save]: buttonManifest, save: buttonManifest },
      })
    ).toThrow(new TypeError("manifests gives save two manifests"))
    expect(() =>
      resolve([], { manifests: [] as unknown as Record<string, Manifest> })
    ).toThrow(
      new TypeError("manifests must be a plain object of manifests by address")
    )
  })

  it("rejects an overlay that sets a semantic value or a destructive variant", () => {
    const input = stored("personal", [
      setProp(save, "variant", "destructive"),
      setProp(remove, "variant", "outline"),
      setProp(save, "size", "lg"),
    ])
    const result = validateOverlay(input, {
      layers: {
        overlays: [],
        surface,
        manifests,
        flags: { [remove]: { destructive: true } },
      },
    })
    expect(result.error?.issues).toEqual([
      {
        code: "custom",
        path: ["ops", 0],
        message:
          "The item save can't take variant destructive, which only the app assigns",
      },
      {
        code: "custom",
        path: ["ops", 1],
        message:
          "The item delete-account is destructive, so its variant can't change",
      },
    ])
    expect(() =>
      validateOverlay(input, {
        layers: {
          overlays: [],
          surface,
          manifests: { [save]: {} as Manifest },
        },
      })
    ).toThrow(
      new TypeError(
        `layers.manifests["${save}"] must be a manifest at an address`
      )
    )
  })
})
