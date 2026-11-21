import { describe, expect, it } from "vitest"

import type { Layer } from "@pliantui/contract"

import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import {
  resolveLayers,
  type ResolvedLayers,
  type ResolveLayersOptions,
} from "./resolve-layers"
import { validateOverlay } from "./validate-overlay"

const surface = "/tickets"

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

function skips({ skipped }: ResolvedLayers) {
  return skipped.flatMap((entry) =>
    entry.reason === "guardrail"
      ? [
          {
            layer: entry.overlay.layer,
            guardrail: entry.guardrail,
            node: entry.node,
          },
        ]
      : []
  )
}

const wrap = (target: string, items: string[], id = "group") => ({
  op: "wrap",
  target,
  id,
  items,
  mode: "stack",
})

const form = "page/slots/ticket-form"

function resolve(
  overlays: LoadedOverlay[],
  options: Partial<ResolveLayersOptions> = {}
) {
  return resolveLayers(overlays, { surface, ...options })
}

const wrapped = (result: ResolvedLayers, id = "group") =>
  result.properties.get(id)?.get("inserted")?.winner.check.op.op === "wrap"

describe("form fields stay in place", () => {
  it.each<[string, Partial<ResolveLayersOptions>]>([
    [
      "a field's schema",
      {
        fields: {
          [`${form}/fields/cc`]: { "~standard": { validate: () => ({}) } },
        },
      },
    ],
    ["a flag", { flags: { [`${form}/fields/cc`]: { defaultable: true } } }],
    [
      "the base order",
      { baseOrder: { "ticket-form/fields": ["title", "cc"] } },
    ],
  ])("skips a wrap that takes a field known from %s", (_, options) => {
    const result = resolve(
      [overlay("personal", [wrap(form, ["notes", "cc"])])],
      options
    )
    expect(wrapped(result)).toBe(false)
    expect(skips(result)).toEqual([
      {
        layer: "personal",
        guardrail: "stays-in-place",
        node: "ticket-form/fields/cc",
      },
    ])
  })

  it("applies a wrap of other nodes, and of fields of another form", () => {
    const options = { baseOrder: { "ticket-form/fields": ["title", "cc"] } }
    const result = resolve(
      [
        overlay("personal", [
          wrap("page", ["ticket-form", "cc"]),
          wrap("other-form", ["title", "cc"], "pair"),
        ]),
      ],
      options
    )
    expect(wrapped(result)).toBe(true)
    expect(wrapped(result, "pair")).toBe(true)
    expect(result.skipped).toEqual([])
  })

  it("keeps a collapsed field in its form", () => {
    const result = resolve(
      [
        overlay("personal", [
          { op: "collapse", target: form, items: ["cc"], into: "more" },
        ]),
      ],
      { baseOrder: { "ticket-form/fields": ["title", "cc"] } }
    )
    expect(result.skipped).toEqual([])
    expect(result.placements.get("ticket-form/fields/cc")).toBeUndefined()
  })

  it("leaves a wrap that doesn't apply to the rule that stops it", () => {
    const result = resolve(
      [overlay("personal", [wrap(form, ["title", "notes"], "ticket-form")])],
      {
        baseIds: ["page", "ticket-form"],
        baseOrder: { "ticket-form/fields": ["title"] },
      }
    )
    expect(result.unapplied.map(({ reason }) => reason)).toEqual([
      "id-collision",
    ])
    expect(result.skipped).toEqual([])
  })

  it("rejects an overlay that wraps form fields", () => {
    const input = stored("personal", [wrap(form, ["title", "cc"])])
    const result = validateOverlay(input, {
      layers: {
        overlays: [],
        surface,
        baseOrder: { "ticket-form/fields": ["title", "cc"] },
      },
    })
    expect(result.error?.issues).toEqual([
      {
        code: "custom",
        path: ["ops", 0],
        message:
          "The item ticket-form/fields/title is a form field, so it can't move into a new parent",
      },
    ])
  })

  it("rejects a wrap of fields named in fields without the layers below", () => {
    const input = stored("personal", [wrap(form, ["title", "cc"])])
    const schema = { "~standard": { validate: () => ({}) } }
    expect(validateOverlay(input).success).toBe(true)
    expect(
      validateOverlay(input, { fields: { [`${form}/fields/cc`]: schema } })
        .error?.issues
    ).toEqual([
      {
        code: "custom",
        path: ["ops", 0],
        message:
          "The item ticket-form/fields/cc is a form field, so it can't move into a new parent",
      },
    ])
  })
})
